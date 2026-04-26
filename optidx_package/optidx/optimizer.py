from __future__ import annotations

import heapq
from time import monotonic
from typing import Any, Dict, Iterable, List, Mapping

from .constraints import (
    normalize_project_constraints,
    normalize_search_config,
    normalize_tests,
    tool_allowed,
)
from .engine import DiagnosticPathwayEngine
from .grammar import (
    apply_expansion_action,
    canonical_signature,
    compile_state_pathway,
    describe_pathway,
    generate_legal_actions,
)
from .metrics import dominates, enrich_metrics, partial_state_dominates
from .models import CandidatePathway, OptimizationConstraints, OptimizerConfig, SearchLeaf, SearchState
from .validation import stable_pathway_id, validate_acyclic, validate_branch_exclusivity, validate_candidate_pathway


OUTPUT_SPECS = [
    ('least_cost_per_positive_test', 'Least cost per positive test', 'cost_per_positive_test', 'min'),
    ('highest_balanced_accuracy', 'Highest balanced accuracy', 'balanced_accuracy', 'max'),
    ('highest_youden_index', "Highest Youden's Index J", 'youden_j', 'max'),
    ('least_turnaround_time', 'Least turnaround time', 'expected_turnaround_time_population', 'min'),
    ('lowest_average_cost_per_patient', 'Lowest average cost per patient', 'expected_cost_population', 'min'),
    ('highest_sensitivity', 'Highest sensitivity', 'sensitivity', 'max'),
    ('highest_specificity', 'Highest specificity', 'specificity', 'max'),
    ('most_cost_effective', 'Most cost-effective', 'cost_per_true_positive_detected', 'min'),
]


def optimize_pathways(
    tests: Mapping[str, Dict[str, Any]] | List[Dict[str, Any]],
    constraints: Mapping[str, Any],
    search_config: Mapping[str, Any] | None = None,
) -> Dict[str, Any]:
    started_at = monotonic()
    normalized_constraints = normalize_project_constraints(constraints)
    normalized_search = normalize_search_config(search_config)
    normalized_tests = normalize_tests(tests)

    warnings: List[str] = []
    rejection_summary = _empty_rejection_summary()
    assumptions = {
        'partial_bound_model': 'safe optimistic probability-mass bounds',
        'repeat_test_probability_model': 'conditionally independent by default',
        'sample_burden_model': 'set union with repeated-sample reuse',
        'setting_behavior': 'reporting only',
    }

    filtered_tests = {
        test_id: tool
        for test_id, tool in normalized_tests.items()
        if tool_allowed(tool, normalized_constraints)
    }
    for test_id, tool in normalized_tests.items():
        if test_id not in filtered_tests:
            _count_tool_rejections(tool, normalized_constraints, rejection_summary)

    frontier: list[CandidatePathway] = []
    complete_candidates: list[CandidatePathway] = []
    search_exhaustive = True
    expanded_count = 0
    completed_count = 0
    pruned_count = 0
    seen_complete_ids: set[str] = set()
    memo: Dict[str, Dict[str, float]] = {}
    queue: list[tuple[Any, int, SearchState]] = []
    sequence = 0

    initial_state = _initial_state()
    heapq.heappush(queue, (_priority(initial_state, normalized_constraints), sequence, initial_state))
    sequence += 1

    while queue:
        if len(complete_candidates) >= normalized_search.max_candidates:
            search_exhaustive = False
            warnings.append('Candidate evaluation reached the configured maximum candidate count.')
            break

        elapsed = monotonic() - started_at
        if elapsed > normalized_search.time_limit_seconds:
            search_exhaustive = False
            warnings.append('Search reached the configured time limit.')
            break

        _, _, state = heapq.heappop(queue)

        if _memo_dominated(state, memo):
            pruned_count += 1
            continue
        _update_memo(state, memo)

        if _violates_hard_bounds(state, normalized_constraints):
            pruned_count += 1
            _count_bound_rejections(state, normalized_constraints, rejection_summary)
            continue

        if _frontier_dominates_state(frontier, state):
            pruned_count += 1
            continue

        if not state.unresolved_leaves:
            pathway_json = compile_state_pathway(state)
            try:
                validate_candidate_pathway(pathway_json)
                validate_branch_exclusivity(pathway_json)
                validate_acyclic(pathway_json)
            except Exception as exc:
                pruned_count += 1
                warnings.append(str(exc))
                continue

            pathway_id = stable_pathway_id(pathway_json)
            if pathway_id in seen_complete_ids:
                pruned_count += 1
                continue
            seen_complete_ids.add(pathway_id)

            try:
                engine = DiagnosticPathwayEngine.from_dict(pathway_json)
                metrics = enrich_metrics(engine.aggregate_metrics(normalized_constraints.prevalence), normalized_constraints.prevalence)
            except Exception as exc:
                pruned_count += 1
                warnings.append(str(exc))
                continue

            if not _satisfies_hard_constraints(metrics, normalized_constraints):
                pruned_count += 1
                _count_metric_rejections(metrics, normalized_constraints, rejection_summary)
                continue

            candidate = _build_candidate(pathway_id, pathway_json, metrics, normalized_constraints, state)
            frontier = _update_pareto_frontier(frontier, candidate)
            complete_candidates.append(candidate)
            completed_count += 1
            continue

        actions = generate_legal_actions(state, filtered_tests, normalized_constraints, normalized_search)
        if not actions:
            pruned_count += 1
            continue

        for action in actions:
            child = apply_expansion_action(
                state,
                action,
                filtered_tests,
                normalized_constraints.prevalence,
                normalized_search,
            )
            if child is None:
                pruned_count += 1
                continue
            if _violates_hard_bounds(child, normalized_constraints):
                pruned_count += 1
                _count_bound_rejections(child, normalized_constraints, rejection_summary)
                continue
            if _frontier_dominates_state(frontier, child):
                pruned_count += 1
                continue

            heapq.heappush(queue, (_priority(child, normalized_constraints), sequence, child))
            sequence += 1

        expanded_count += 1

    selected_outputs = _select_outputs(frontier)
    frontier_payload = [_candidate_to_payload(candidate) for candidate in frontier]
    feasible_count = len(frontier)
    status = 'success'
    message = None

    if feasible_count == 0:
        if search_exhaustive:
            status = 'infeasible'
            message = 'No pathway can fulfil the selected constraints.'
        else:
            status = 'no_feasible_found_time_limit'
            message = 'No feasible pathway was found within the time limit. Because the search was not exhaustive, the system cannot claim that no feasible pathway exists.'
    elif not search_exhaustive:
        status = 'partial_success_time_limit'
        message = 'Search time limit reached. Returned pathways are the best found so far and may not be globally optimal within the configured grammar.'

    result = {
        'inputs': {
            'available_test_count': len(normalized_tests),
            'filtered_test_count': len(filtered_tests),
            'tests': list(normalized_tests.keys()),
        },
        'constraints': _constraints_payload(normalized_constraints),
        'prevalence': normalized_constraints.prevalence,
        'status': status,
        'search_exhaustive': search_exhaustive,
        'selected_outputs': selected_outputs,
        'pareto_frontier': frontier_payload,
        'pareto_frontier_ids': [candidate.pathway_id for candidate in frontier],
        'feasible_candidate_count': feasible_count,
        'candidate_count': len(complete_candidates),
        'search_summary': {
            'exhaustive': search_exhaustive,
            'completed_count': completed_count,
            'expanded_count': expanded_count,
            'pruned_count': pruned_count,
            'frontier_size': len(frontier),
            'time_seconds': round(monotonic() - started_at, 3),
        },
        'assumptions': assumptions,
        'warnings': _dedupe_strings(warnings),
        'run_ms': int((monotonic() - started_at) * 1000),
    }
    if message:
        result['message'] = message
    if status != 'success':
        result['rejection_summary'] = rejection_summary
    return result


def _initial_state() -> SearchState:
    state = SearchState(
        start_node='start',
        tests={},
        partial_pathway_graph={
            'final_positive': {'final_classification': 'positive'},
            'final_negative': {'final_classification': 'negative'},
        },
        unresolved_leaves=[SearchLeaf(node_id='start', disease_mass=1.0, no_disease_mass=1.0, stage_count=0)],
        depth_or_stage_count=0,
        search_trace={'next_node_index': 1, 'expanded_action_count': 0},
    )
    state.canonical_signature = canonical_signature(state)
    return state


def _priority(state: SearchState, constraints: OptimizationConstraints) -> tuple[Any, ...]:
    current_sensitivity_lower = state.resolved_positive_mass_disease
    current_specificity_lower = state.resolved_negative_mass_no_disease
    sensitivity_gap = max(0.0, constraints.min_sensitivity - current_sensitivity_lower)
    specificity_gap = max(0.0, constraints.min_specificity - current_specificity_lower)
    feasibility_penalty = int(sensitivity_gap > 0) + int(specificity_gap > 0)
    complexity_penalty = len(state.tests)
    return (
        feasibility_penalty,
        round(state.current_expected_cost_lower_bound, 8),
        round(state.current_expected_tat_lower_bound, 8),
        round(sensitivity_gap, 8),
        round(specificity_gap, 8),
        -round(state.sensitivity_upper_bound, 8),
        -round(state.specificity_upper_bound, 8),
        complexity_penalty,
    )


def _violates_hard_bounds(state: SearchState, constraints: OptimizationConstraints) -> bool:
    if state.sensitivity_upper_bound < constraints.min_sensitivity:
        return True
    if state.specificity_upper_bound < constraints.min_specificity:
        return True
    if constraints.max_cost_per_patient_usd is not None and state.current_expected_cost_lower_bound > constraints.max_cost_per_patient_usd:
        return True
    if constraints.max_turnaround_time_hours is not None and state.current_expected_tat_lower_bound > constraints.max_turnaround_time_hours:
        return True
    if 'lab_technician' in state.current_required_skill_roles and not constraints.lab_technician_allowed:
        return True
    if 'radiologist' in state.current_required_skill_roles and not constraints.radiologist_allowed:
        return True
    if 'specialist_physician' in state.current_required_skill_roles and not constraints.specialist_physician_allowed:
        return True
    if 'none' in state.current_sample_types and not constraints.none_allowed:
        return True
    if 'blood' in state.current_sample_types and not constraints.blood_allowed:
        return True
    if 'urine' in state.current_sample_types and not constraints.urine_allowed:
        return True
    if 'stool' in state.current_sample_types and not constraints.stool_allowed:
        return True
    if 'sputum' in state.current_sample_types and not constraints.sputum_allowed:
        return True
    if 'nasal_swab' in state.current_sample_types and not constraints.nasal_swab_allowed:
        return True
    if 'imaging' in state.current_sample_types and not constraints.imaging_allowed:
        return True
    return False


def _satisfies_hard_constraints(metrics: Dict[str, Any], constraints: OptimizationConstraints) -> bool:
    if float(metrics.get('sensitivity', 0.0)) < constraints.min_sensitivity:
        return False
    if float(metrics.get('specificity', 0.0)) < constraints.min_specificity:
        return False
    if constraints.max_cost_per_patient_usd is not None and float(metrics.get('expected_cost_population', 0.0)) > constraints.max_cost_per_patient_usd:
        return False
    if constraints.max_turnaround_time_hours is not None and float(metrics.get('expected_turnaround_time_population', 0.0)) > constraints.max_turnaround_time_hours:
        return False
    return True


def _frontier_dominates_state(frontier: list[CandidatePathway], state: SearchState) -> bool:
    future = {
        'cost_lower_bound': state.current_expected_cost_lower_bound,
        'tat_lower_bound': state.current_expected_tat_lower_bound,
        'sensitivity_upper_bound': state.sensitivity_upper_bound,
        'specificity_upper_bound': state.specificity_upper_bound,
        'complexity': len(state.tests),
    }
    for candidate in frontier:
        metrics = candidate.metrics
        candidate_bounds = {
            'cost_lower_bound': float(metrics.get('expected_cost_population', float('inf'))),
            'tat_lower_bound': float(metrics.get('expected_turnaround_time_population', float('inf'))),
            'sensitivity_upper_bound': float(metrics.get('sensitivity', 0.0)),
            'specificity_upper_bound': float(metrics.get('specificity', 0.0)),
            'complexity': int(candidate.pathway_complexity),
        }
        if partial_state_dominates(candidate_bounds, future):
            return True
    return False


def _memo_dominated(state: SearchState, memo: Dict[str, Dict[str, float]]) -> bool:
    existing = memo.get(state.canonical_signature)
    if existing is None:
        return False
    current = _memo_payload(state)
    return partial_state_dominates(existing, current)


def _update_memo(state: SearchState, memo: Dict[str, Dict[str, float]]) -> None:
    current = _memo_payload(state)
    existing = memo.get(state.canonical_signature)
    if existing is None or partial_state_dominates(current, existing):
        memo[state.canonical_signature] = current


def _memo_payload(state: SearchState) -> Dict[str, float]:
    return {
        'cost_lower_bound': state.current_expected_cost_lower_bound,
        'tat_lower_bound': state.current_expected_tat_lower_bound,
        'sensitivity_upper_bound': state.sensitivity_upper_bound,
        'specificity_upper_bound': state.specificity_upper_bound,
        'complexity': float(len(state.tests)),
    }


def _build_candidate(
    pathway_id: str,
    pathway_json: Dict[str, Any],
    metrics: Dict[str, Any],
    constraints: OptimizationConstraints,
    state: SearchState,
) -> CandidatePathway:
    required_roles = sorted(state.current_required_skill_roles)
    sample_types = sorted(state.current_sample_types)
    complexity = len(pathway_json.get('tests', {}))
    warnings = list(metrics.get('warnings', []))
    return CandidatePathway(
        pathway_id=pathway_id,
        objective_name=None,
        pathway_json=pathway_json,
        human_readable_pathway_description=describe_pathway(pathway_json),
        metrics=metrics,
        required_skill_roles=required_roles,
        sample_types=sample_types,
        setting_metadata={
            'primary_care': constraints.primary_care,
            'hospital': constraints.hospital,
            'community': constraints.community,
            'mobile_unit': constraints.mobile_unit,
        },
        pathway_complexity=complexity,
        optimizer_metadata={
            'template_summary': pathway_json.get('metadata', {}).get('template_summary', 'search_candidate'),
            'search_depth': state.depth_or_stage_count,
            'canonical_signature': state.canonical_signature,
        },
        warnings=warnings,
    )


def _update_pareto_frontier(frontier: list[CandidatePathway], candidate: CandidatePathway) -> list[CandidatePathway]:
    if any(dominates(existing.metrics, candidate.metrics) for existing in frontier):
        return frontier
    kept = [existing for existing in frontier if not dominates(candidate.metrics, existing.metrics)]
    kept.append(candidate)
    kept.sort(key=lambda item: (
        float(item.metrics.get('expected_cost_population', float('inf'))),
        float(item.metrics.get('expected_turnaround_time_population', float('inf'))),
        -float(item.metrics.get('sensitivity', 0.0)),
        -float(item.metrics.get('specificity', 0.0)),
        item.pathway_id,
    ))
    return kept


def _select_outputs(frontier: list[CandidatePathway]) -> Dict[str, Any]:
    selected: Dict[str, Any] = {key: None for key, _, _, _ in OUTPUT_SPECS}
    for key, label, metric_name, direction in OUTPUT_SPECS:
        if not frontier:
            continue
        candidate = min(
            frontier,
            key=lambda item: (
                _metric_value(item.metrics, metric_name, direction)
                if direction == 'min'
                else -_metric_value(item.metrics, metric_name, direction),
                float(item.metrics.get('expected_cost_population', float('inf'))),
                float(item.metrics.get('expected_turnaround_time_population', float('inf'))),
                -float(item.metrics.get('sensitivity', 0.0)),
                -float(item.metrics.get('specificity', 0.0)),
                item.pathway_id,
            ),
        )
        selected[key] = {
            **_candidate_to_payload(candidate),
            'objective_name': label,
        }
    return selected


def _candidate_to_payload(candidate: CandidatePathway) -> Dict[str, Any]:
    metrics = candidate.metrics
    return {
        'pathway_id': candidate.pathway_id,
        'objective_name': candidate.objective_name,
        'pathway_json': candidate.pathway_json,
        'human_readable_pathway_description': candidate.human_readable_pathway_description,
        'sensitivity': float(metrics.get('sensitivity', 0.0)),
        'specificity': float(metrics.get('specificity', 0.0)),
        'balanced_accuracy': float(metrics.get('balanced_accuracy', 0.0)),
        'youden_j': float(metrics.get('youden_j', 0.0)),
        'expected_cost_population': float(metrics.get('expected_cost_population', 0.0)),
        'expected_turnaround_time_population': float(metrics.get('expected_turnaround_time_population', 0.0)),
        'probability_algorithm_positive': float(metrics.get('probability_algorithm_positive', 0.0)),
        'cost_per_positive_test': float(metrics.get('cost_per_positive_test', float('inf'))),
        'true_positive_rate': float(metrics.get('true_positive_rate', 0.0)),
        'cost_per_true_positive': float(metrics.get('cost_per_true_positive', float('inf'))),
        'required_skill_roles': candidate.required_skill_roles,
        'sample_types': candidate.sample_types,
        'setting_metadata': candidate.setting_metadata,
        'pathway_complexity': candidate.pathway_complexity,
        'warning_flags': candidate.warnings,
        'metrics': metrics,
        'optimizer_metadata': candidate.optimizer_metadata,
        'template_summary': candidate.optimizer_metadata.get('template_summary'),
        'warnings': candidate.warnings,
    }


def _metric_value(metrics: Dict[str, Any], metric_name: str, direction: str) -> float:
    value = metrics.get(metric_name)
    if value is None:
        return float('inf') if direction == 'min' else float('-inf')
    try:
        return float(value)
    except (TypeError, ValueError):
        return float('inf') if direction == 'min' else float('-inf')


def _constraints_payload(constraints: OptimizationConstraints) -> Dict[str, Any]:
    return {
        'prevalence': constraints.prevalence,
        'min_sensitivity': constraints.min_sensitivity,
        'min_specificity': constraints.min_specificity,
        'max_cost_per_patient_usd': constraints.max_cost_per_patient_usd,
        'max_turnaround_time_hours': constraints.max_turnaround_time_hours,
        'lab_technician_allowed': constraints.lab_technician_allowed,
        'radiologist_allowed': constraints.radiologist_allowed,
        'specialist_physician_allowed': constraints.specialist_physician_allowed,
        'primary_care': constraints.primary_care,
        'hospital': constraints.hospital,
        'community': constraints.community,
        'mobile_unit': constraints.mobile_unit,
        'none_allowed': constraints.none_allowed,
        'blood_allowed': constraints.blood_allowed,
        'urine_allowed': constraints.urine_allowed,
        'stool_allowed': constraints.stool_allowed,
        'sputum_allowed': constraints.sputum_allowed,
        'nasal_swab_allowed': constraints.nasal_swab_allowed,
        'imaging_allowed': constraints.imaging_allowed,
    }


def _empty_rejection_summary() -> Dict[str, int]:
    return {
        'sensitivity_below_minimum': 0,
        'specificity_below_minimum': 0,
        'cost_above_maximum': 0,
        'turnaround_time_above_maximum': 0,
        'requires_lab_technician': 0,
        'requires_radiologist': 0,
        'requires_specialist_physician': 0,
        'requires_disallowed_sample_none': 0,
        'requires_disallowed_sample_blood': 0,
        'requires_disallowed_sample_urine': 0,
        'requires_disallowed_sample_stool': 0,
        'requires_disallowed_sample_sputum': 0,
        'requires_disallowed_sample_nasal_swab': 0,
        'requires_disallowed_sample_imaging': 0,
    }


def _count_tool_rejections(tool, constraints: OptimizationConstraints, rejection_summary: Dict[str, int]) -> None:
    if tool.requires_lab_technician and not constraints.lab_technician_allowed:
        rejection_summary['requires_lab_technician'] += 1
    if tool.requires_radiologist and not constraints.radiologist_allowed:
        rejection_summary['requires_radiologist'] += 1
    if tool.requires_specialist_physician and not constraints.specialist_physician_allowed:
        rejection_summary['requires_specialist_physician'] += 1
    if tool.sample_none and not constraints.none_allowed:
        rejection_summary['requires_disallowed_sample_none'] += 1
    if tool.sample_blood and not constraints.blood_allowed:
        rejection_summary['requires_disallowed_sample_blood'] += 1
    if tool.sample_urine and not constraints.urine_allowed:
        rejection_summary['requires_disallowed_sample_urine'] += 1
    if tool.sample_stool and not constraints.stool_allowed:
        rejection_summary['requires_disallowed_sample_stool'] += 1
    if tool.sample_sputum and not constraints.sputum_allowed:
        rejection_summary['requires_disallowed_sample_sputum'] += 1
    if tool.sample_nasal_swab and not constraints.nasal_swab_allowed:
        rejection_summary['requires_disallowed_sample_nasal_swab'] += 1
    if tool.sample_imaging and not constraints.imaging_allowed:
        rejection_summary['requires_disallowed_sample_imaging'] += 1


def _count_bound_rejections(state: SearchState, constraints: OptimizationConstraints, rejection_summary: Dict[str, int]) -> None:
    if state.sensitivity_upper_bound < constraints.min_sensitivity:
        rejection_summary['sensitivity_below_minimum'] += 1
    if state.specificity_upper_bound < constraints.min_specificity:
        rejection_summary['specificity_below_minimum'] += 1
    if constraints.max_cost_per_patient_usd is not None and state.current_expected_cost_lower_bound > constraints.max_cost_per_patient_usd:
        rejection_summary['cost_above_maximum'] += 1
    if constraints.max_turnaround_time_hours is not None and state.current_expected_tat_lower_bound > constraints.max_turnaround_time_hours:
        rejection_summary['turnaround_time_above_maximum'] += 1


def _count_metric_rejections(metrics: Dict[str, Any], constraints: OptimizationConstraints, rejection_summary: Dict[str, int]) -> None:
    if float(metrics.get('sensitivity', 0.0)) < constraints.min_sensitivity:
        rejection_summary['sensitivity_below_minimum'] += 1
    if float(metrics.get('specificity', 0.0)) < constraints.min_specificity:
        rejection_summary['specificity_below_minimum'] += 1
    if constraints.max_cost_per_patient_usd is not None and float(metrics.get('expected_cost_population', 0.0)) > constraints.max_cost_per_patient_usd:
        rejection_summary['cost_above_maximum'] += 1
    if constraints.max_turnaround_time_hours is not None and float(metrics.get('expected_turnaround_time_population', 0.0)) > constraints.max_turnaround_time_hours:
        rejection_summary['turnaround_time_above_maximum'] += 1


def _dedupe_strings(items: Iterable[str]) -> List[str]:
    deduped: List[str] = []
    for item in items:
        if not item or item in deduped:
            continue
        deduped.append(item)
    return deduped
