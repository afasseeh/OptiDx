import math

import pytest

import optidx_package.optidx.optimizer as optimizer_module
from optidx_package.optidx.constraints import normalize_project_constraints, normalize_search_config, normalize_tests
from optidx_package.optidx.engine import DiagnosticPathwayEngine
from optidx_package.optidx.grammar import apply_expansion_action, compile_state_pathway
from optidx_package.optidx.optimizer import (
    _build_candidate,
    _frontier_dominates_state,
    _initial_state,
    _memo_dominated,
    _priority,
    _select_outputs,
    _update_memo,
    _update_pareto_frontier,
    _violates_hard_bounds,
    optimize_pathways,
)


def _tool_catalog():
    # The optimizer derives role booleans from the legacy skill level when the
    # explicit flags are absent, so these fixtures exercise both the legacy and
    # canonical normalization paths.
    return {
        'A': {
            'name': 'A',
            'sensitivity': 0.90,
            'specificity': 0.80,
            'cost': 2.0,
            'turnaround_time': 1.0,
            'turnaround_time_unit': 'hr',
            'sample_types': ['blood'],
            'skill_level': 1,
        },
        'B': {
            'name': 'B',
            'sensitivity': 0.95,
            'specificity': 0.90,
            'cost': 8.0,
            'turnaround_time': 3.0,
            'turnaround_time_unit': 'hr',
            'sample_types': ['sputum'],
            'skill_level': 3,
        },
        'C': {
            'name': 'C',
            'sensitivity': 0.85,
            'specificity': 0.97,
            'cost': 6.0,
            'turnaround_time': 2.0,
            'turnaround_time_unit': 'hr',
            'sample_types': ['urine'],
            'skill_level': 2,
        },
    }


def _constraints(**overrides):
    base = {
        'prevalence': 0.10,
        'min_sensitivity': 0.0,
        'min_specificity': 0.0,
        'lab_technician_allowed': True,
        'radiologist_allowed': True,
        'specialist_physician_allowed': True,
        'none_allowed': True,
        'blood_allowed': True,
        'urine_allowed': True,
        'stool_allowed': True,
        'sputum_allowed': True,
        'nasal_swab_allowed': True,
        'imaging_allowed': True,
    }
    base.update(overrides)
    return base


def _compile_metrics(action_type, base_test_ids, prevalence=0.10):
    tests = normalize_tests(_tool_catalog())
    state = _initial_state()
    config = normalize_search_config({'max_stages': 4, 'max_tests_per_realized_path': 6})
    child = apply_expansion_action(
        state,
        {'type': action_type, 'leaf_id': 'start', 'tests': list(base_test_ids)},
        tests,
        prevalence,
        config,
    )
    assert child is not None
    pathway = compile_state_pathway(child)
    metrics = DiagnosticPathwayEngine.from_dict(pathway).aggregate_metrics(prevalence)
    return child, pathway, metrics


def test_single_test_pathway_metrics():
    _, _, metrics = _compile_metrics('single', ['A'])
    assert math.isclose(metrics['sensitivity'], 0.90, rel_tol=1e-9)
    assert math.isclose(metrics['specificity'], 0.80, rel_tol=1e-9)


def test_serial_confirm_pathway_metrics():
    _, _, metrics = _compile_metrics('serial_confirm', ['A', 'B'])
    assert math.isclose(metrics['sensitivity'], 0.90 * 0.95, rel_tol=1e-9)
    assert math.isclose(metrics['specificity'], 1 - ((1 - 0.80) * (1 - 0.90)), rel_tol=1e-9)


def test_serial_rescue_pathway_metrics():
    _, _, metrics = _compile_metrics('serial_rescue', ['A', 'B'])
    assert math.isclose(metrics['sensitivity'], 1 - ((1 - 0.90) * (1 - 0.95)), rel_tol=1e-9)
    assert math.isclose(metrics['specificity'], 0.80 * 0.90, rel_tol=1e-9)


def test_parallel_or_pathway_metrics():
    _, _, metrics = _compile_metrics('parallel_or', ['A', 'B'])
    assert math.isclose(metrics['sensitivity'], 1 - ((1 - 0.90) * (1 - 0.95)), rel_tol=1e-9)
    assert math.isclose(metrics['specificity'], 0.80 * 0.90, rel_tol=1e-9)


def test_parallel_and_pathway_metrics():
    _, _, metrics = _compile_metrics('parallel_and', ['A', 'B'])
    assert math.isclose(metrics['sensitivity'], 0.90 * 0.95, rel_tol=1e-9)
    assert math.isclose(metrics['specificity'], 1 - ((1 - 0.80) * (1 - 0.90)), rel_tol=1e-9)


def test_discordant_referee_pathway_metrics():
    _, _, metrics = _compile_metrics('discordant_referee', ['A', 'B', 'C'])
    expected_sensitivity = (0.90 * 0.95) + ((0.90 * 0.05) + (0.10 * 0.95)) * 0.85
    expected_specificity = (0.80 * 0.90) + (((1 - 0.80) * 0.90) + (0.80 * (1 - 0.90))) * 0.97
    assert math.isclose(metrics['sensitivity'], expected_sensitivity, rel_tol=1e-9)
    assert math.isclose(metrics['specificity'], expected_specificity, rel_tol=1e-9)


def test_repeated_test_aliasing_preserves_separate_invocations():
    child, pathway, metrics = _compile_metrics('serial_confirm', ['A', 'A'])
    assert set(pathway['tests'].keys()) == {'A', 'A__2'}
    assert child.test_invocations == {'A': 2}
    assert math.isclose(metrics['sensitivity'], 0.90 * 0.90, rel_tol=1e-9)


def test_hard_constraint_infeasibility_reports_exhaustive_message():
    result = optimize_pathways(
        {'A': _tool_catalog()['A']},
        _constraints(min_sensitivity=0.99, min_specificity=0.99),
        {'time_limit_seconds': 10, 'max_candidates': 100},
    )
    assert result['status'] == 'infeasible'
    assert result['search_exhaustive'] is True
    assert result['message'] == 'No pathway can fulfil the selected constraints.'
    assert result['rejection_summary']['sensitivity_below_minimum'] > 0


def test_partial_state_bound_pruning_rejects_disallowed_cost_and_role():
    tests = normalize_tests(_tool_catalog())
    constraints = normalize_project_constraints(
        _constraints(
            max_cost_per_patient_usd=0.5,
            lab_technician_allowed=False,
        )
    )
    state = _initial_state()
    config = normalize_search_config({})
    child = apply_expansion_action(
        state,
        {'type': 'single', 'leaf_id': 'start', 'tests': ['A']},
        tests,
        constraints.prevalence,
        config,
    )
    assert child is not None
    assert _violates_hard_bounds(child, constraints) is True


def test_partial_state_dominance_memo_prunes_worse_equivalent_state():
    better = _initial_state()
    better.current_expected_cost_lower_bound = 1.0
    better.current_expected_tat_lower_bound = 1.0
    better.sensitivity_upper_bound = 0.95
    better.specificity_upper_bound = 0.90
    better.canonical_signature = 'same-structure'

    worse = _initial_state()
    worse.current_expected_cost_lower_bound = 2.0
    worse.current_expected_tat_lower_bound = 2.0
    worse.sensitivity_upper_bound = 0.90
    worse.specificity_upper_bound = 0.85
    worse.canonical_signature = 'same-structure'

    memo = {}
    _update_memo(better, memo)
    assert _memo_dominated(worse, memo) is True


def test_pareto_frontier_removes_dominated_pathways_and_selects_outputs():
    constraints = normalize_project_constraints(_constraints(primary_care=True))
    base_state = _initial_state()

    high_value_candidate = _build_candidate(
        'P_best',
        {'start_node': 'start', 'tests': {}, 'nodes': {}, 'metadata': {'template_summary': 'best'}},
        {
            'sensitivity': 0.95,
            'specificity': 0.92,
            'balanced_accuracy': 0.935,
            'youden_j': 0.87,
            'expected_cost_population': 5.0,
            'expected_turnaround_time_population': 1.0,
            'probability_algorithm_positive': 0.158,
            'true_positive_rate': 0.095,
            'cost_per_positive_test': 31.645569620253163,
            'cost_per_true_positive_detected': 52.631578947368425,
        },
        constraints,
        base_state,
    )
    dominated_candidate = _build_candidate(
        'P_worse',
        {'start_node': 'start', 'tests': {}, 'nodes': {}, 'metadata': {'template_summary': 'worse'}},
        {
            'sensitivity': 0.90,
            'specificity': 0.90,
            'balanced_accuracy': 0.90,
            'youden_j': 0.80,
            'expected_cost_population': 7.0,
            'expected_turnaround_time_population': 2.0,
            'probability_algorithm_positive': 0.18,
            'true_positive_rate': 0.09,
            'cost_per_positive_test': 38.888888888888886,
            'cost_per_true_positive_detected': 77.77777777777777,
        },
        constraints,
        base_state,
    )

    frontier = _update_pareto_frontier([], dominated_candidate)
    frontier = _update_pareto_frontier(frontier, high_value_candidate)
    assert [candidate.pathway_id for candidate in frontier] == ['P_best']

    selected = _select_outputs(frontier)
    assert all(payload['pathway_id'] == 'P_best' for payload in selected.values() if payload is not None)


def test_time_limit_behavior_returns_non_exhaustive_no_result():
    calls = iter([0.0, 2.0, 2.0, 2.0])
    original_monotonic = optimizer_module.monotonic
    optimizer_module.monotonic = lambda: next(calls, 2.0)
    try:
        result = optimize_pathways(
            _tool_catalog(),
            _constraints(min_sensitivity=0.9999, min_specificity=0.9999),
            {'time_limit_seconds': 1, 'max_candidates': 1000},
        )
    finally:
        optimizer_module.monotonic = original_monotonic

    assert result['status'] == 'no_feasible_found_time_limit'
    assert result['search_exhaustive'] is False
    assert 'time limit' in result['message'].lower()


def test_priority_prefers_more_promising_lower_bound_state():
    constraints = normalize_project_constraints(_constraints(min_sensitivity=0.90, min_specificity=0.90))
    better = _initial_state()
    better.current_expected_cost_lower_bound = 2.0
    better.current_expected_tat_lower_bound = 1.0
    better.resolved_positive_mass_disease = 0.80
    better.resolved_negative_mass_no_disease = 0.80
    better.sensitivity_upper_bound = 0.98
    better.specificity_upper_bound = 0.98

    worse = _initial_state()
    worse.current_expected_cost_lower_bound = 5.0
    worse.current_expected_tat_lower_bound = 4.0
    worse.resolved_positive_mass_disease = 0.40
    worse.resolved_negative_mass_no_disease = 0.40
    worse.sensitivity_upper_bound = 0.85
    worse.specificity_upper_bound = 0.85

    assert _priority(better, constraints) < _priority(worse, constraints)


def test_frontier_can_prune_partial_state_with_no_better_future():
    constraints = normalize_project_constraints(_constraints(primary_care=True))
    state = _initial_state()
    state.current_expected_cost_lower_bound = 7.0
    state.current_expected_tat_lower_bound = 3.0
    state.sensitivity_upper_bound = 0.80
    state.specificity_upper_bound = 0.80

    frontier_candidate = _build_candidate(
        'P_frontier',
        {'start_node': 'start', 'tests': {}, 'nodes': {}, 'metadata': {'template_summary': 'frontier'}},
        {
            'sensitivity': 0.85,
            'specificity': 0.85,
            'balanced_accuracy': 0.85,
            'youden_j': 0.70,
            'expected_cost_population': 5.0,
            'expected_turnaround_time_population': 2.0,
            'probability_algorithm_positive': 0.22,
            'true_positive_rate': 0.085,
            'cost_per_positive_test': 22.727272727272727,
            'cost_per_true_positive_detected': 58.8235294117647,
        },
        constraints,
        _initial_state(),
    )

    assert _frontier_dominates_state([frontier_candidate], state) is True
