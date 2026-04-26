from __future__ import annotations

from itertools import combinations
from typing import Any, Dict, Iterable, List

from .constraints import DiagnosticTool, tool_required_roles, tool_sample_flags
from .models import CandidatePathway, OptimizationConstraints, OptimizerConfig, SearchLeaf, SearchState
from .pathway_builder import build_pathway_metadata
from .validation import stable_pathway_id


def generate_legal_actions(
    state: SearchState,
    tests: Dict[str, DiagnosticTool],
    constraints: OptimizationConstraints,
    config: OptimizerConfig,
) -> List[Dict[str, Any]]:
    actions: List[Dict[str, Any]] = []
    if not state.unresolved_leaves:
        return actions

    for leaf in state.unresolved_leaves:
        for test_id in sorted(tests.keys()):
            if leaf.stage_count + 1 <= config.max_stages and len(leaf.tests_used_on_path) + 1 <= config.max_tests_per_realized_path:
                actions.append({'type': 'single', 'leaf_id': leaf.node_id, 'tests': [test_id]})
                actions.append({'type': 'triage_positive_continue', 'leaf_id': leaf.node_id, 'tests': [test_id]})
                actions.append({'type': 'triage_negative_continue', 'leaf_id': leaf.node_id, 'tests': [test_id]})
            if len(leaf.tests_used_on_path) + 2 <= config.max_tests_per_realized_path and leaf.stage_count + 2 <= config.max_stages:
                for second in sorted(tests.keys()):
                    actions.append({'type': 'serial_confirm', 'leaf_id': leaf.node_id, 'tests': [test_id, second]})
                    actions.append({'type': 'serial_rescue', 'leaf_id': leaf.node_id, 'tests': [test_id, second]})

        for size in range(2, min(config.max_parallel_block_size, 3) + 1):
            if len(leaf.tests_used_on_path) + size > config.max_tests_per_realized_path or leaf.stage_count + 1 > config.max_stages:
                continue
            for test_ids in combinations(sorted(tests.keys()), size):
                actions.append({'type': 'parallel_or', 'leaf_id': leaf.node_id, 'tests': list(test_ids)})
                actions.append({'type': 'parallel_and', 'leaf_id': leaf.node_id, 'tests': list(test_ids)})

        if len(leaf.tests_used_on_path) + 3 <= config.max_tests_per_realized_path and leaf.stage_count + 2 <= config.max_stages:
            for pair in combinations(sorted(tests.keys()), 2):
                remaining = [test_id for test_id in sorted(tests.keys()) if test_id not in pair]
                for referee in remaining:
                    actions.append({'type': 'discordant_referee', 'leaf_id': leaf.node_id, 'tests': [pair[0], pair[1], referee]})

    return actions


def apply_expansion_action(
    state: SearchState,
    action: Dict[str, Any],
    tests: Dict[str, DiagnosticTool],
    prevalence: float,
    config: OptimizerConfig,
) -> SearchState | None:
    leaf = next((item for item in state.unresolved_leaves if item.node_id == action['leaf_id']), None)
    if leaf is None:
        return None

    aliases = _allocate_aliases(state.test_invocations, action['tests'])
    if aliases is None:
        return None

    next_state = _clone_state(state)
    next_state.unresolved_leaves = [item for item in state.unresolved_leaves if item.node_id != leaf.node_id]
    next_state.depth_or_stage_count = max(next_state.depth_or_stage_count, leaf.stage_count)

    for alias, base_test_id in zip(aliases['aliases'], action['tests']):
        next_state.tests[alias] = _tool_payload(tests[base_test_id], alias, base_test_id)
    next_state.test_invocations = aliases['counts']

    updater = {
        'single': _apply_single,
        'serial_confirm': _apply_serial_confirm,
        'serial_rescue': _apply_serial_rescue,
        'parallel_or': _apply_parallel_or,
        'parallel_and': _apply_parallel_and,
        'discordant_referee': _apply_discordant_referee,
        'triage_positive_continue': _apply_triage_positive_continue,
        'triage_negative_continue': _apply_triage_negative_continue,
    }.get(action['type'])

    if updater is None:
        return None

    if not updater(next_state, leaf, action['tests'], aliases['aliases'], tests, prevalence, config):
        return None

    next_state.current_sample_types = tuple(sorted(set(next_state.current_sample_types)))
    next_state.current_required_skill_roles = tuple(sorted(set(next_state.current_required_skill_roles)))
    next_state.unresolved_mass_disease = sum(item.disease_mass for item in next_state.unresolved_leaves)
    next_state.unresolved_mass_no_disease = sum(item.no_disease_mass for item in next_state.unresolved_leaves)
    next_state.sensitivity_upper_bound = next_state.resolved_positive_mass_disease + next_state.unresolved_mass_disease
    next_state.specificity_upper_bound = next_state.resolved_negative_mass_no_disease + next_state.unresolved_mass_no_disease
    next_state.canonical_signature = canonical_signature(next_state)
    next_state.search_trace['expanded_action_count'] = int(next_state.search_trace.get('expanded_action_count', 0)) + 1

    return next_state


def compile_state_pathway(state: SearchState) -> Dict[str, Any]:
    labels = {
        key: value.get('base_test_id', key)
        for key, value in state.tests.items()
    }
    return {
        'start_node': state.start_node,
        'tests': state.tests,
        'nodes': state.partial_pathway_graph,
        'metadata': build_pathway_metadata(
            label='search_candidate',
            base_tool_map=labels,
        ),
    }


def canonical_signature(state: SearchState) -> str:
    nodes: list[Dict[str, Any]] = []
    tests = state.tests
    for node_id, node in sorted((state.partial_pathway_graph or {}).items()):
        action = node.get('action')
        if action:
            normalized_tests = [
                tests.get(test_name, {}).get('base_test_id', test_name)
                for test_name in action.get('test_names', [])
            ]
            if action.get('mode') == 'parallel':
                normalized_tests = sorted(normalized_tests)
            branches = []
            for branch in node.get('branches', []):
                normalized_conditions = {
                    tests.get(test_name, {}).get('base_test_id', test_name): outcome
                    for test_name, outcome in sorted((branch.get('conditions') or {}).items())
                }
                next_node = branch.get('next_node')
                if next_node == 'final_positive':
                    next_label = 'final_positive'
                elif next_node == 'final_negative':
                    next_label = 'final_negative'
                else:
                    next_label = 'continue'
                branches.append({'conditions': normalized_conditions, 'next': next_label})
            nodes.append({'mode': action.get('mode', 'sequential'), 'tests': normalized_tests, 'branches': branches})

    unresolved = [
        {
            'stage_count': leaf.stage_count,
            'tests_used_on_path': list(leaf.tests_used_on_path),
            'disease_mass': round(leaf.disease_mass, 6),
            'no_disease_mass': round(leaf.no_disease_mass, 6),
        }
        for leaf in sorted(state.unresolved_leaves, key=lambda item: item.node_id)
    ]

    payload = {
        'nodes': nodes,
        'unresolved': unresolved,
        'roles': list(state.current_required_skill_roles),
        'samples': list(state.current_sample_types),
        'cost': round(state.current_expected_cost_lower_bound, 6),
        'tat': round(state.current_expected_tat_lower_bound, 6),
        'sens_ub': round(state.sensitivity_upper_bound, 6),
        'spec_ub': round(state.specificity_upper_bound, 6),
        'complexity': len(state.tests),
    }
    return stable_pathway_id(payload)


def describe_pathway(pathway_json: Dict[str, Any]) -> str:
    tests = pathway_json.get('tests', {})
    nodes = pathway_json.get('nodes', {})
    start_node = pathway_json.get('start_node')

    def render(node_id: str) -> str:
        node = nodes.get(node_id) or {}
        if node.get('final_classification') == 'positive':
            return 'final positive'
        if node.get('final_classification') == 'negative':
            return 'final negative'

        action = node.get('action') or {}
        base_names = [
            tests.get(test_name, {}).get('base_test_id', test_name)
            for test_name in action.get('test_names', [])
        ]
        if action.get('mode') == 'parallel':
            head = 'parallel(' + ' + '.join(base_names) + ')'
        else:
            head = ' then '.join(base_names)

        branches = []
        for branch in node.get('branches', []):
            conditions = branch.get('conditions') or {}
            condition_text = ', '.join(
                f"{tests.get(test_name, {}).get('base_test_id', test_name)} {outcome}"
                for test_name, outcome in conditions.items()
            )
            branches.append(f"{condition_text} -> {render(branch.get('next_node'))}")
        return f"{head}: " + '; '.join(branches)

    return render(start_node)


def _clone_state(state: SearchState) -> SearchState:
    return SearchState(
        start_node=state.start_node,
        tests={key: dict(value) for key, value in state.tests.items()},
        partial_pathway_graph={key: dict(value) for key, value in state.partial_pathway_graph.items()},
        unresolved_leaves=[SearchLeaf(**vars(leaf)) for leaf in state.unresolved_leaves],
        depth_or_stage_count=state.depth_or_stage_count,
        tests_used_on_each_realized_path=list(state.tests_used_on_each_realized_path),
        test_invocations=dict(state.test_invocations),
        current_sample_types=tuple(state.current_sample_types),
        current_required_skill_roles=tuple(state.current_required_skill_roles),
        current_expected_cost_lower_bound=state.current_expected_cost_lower_bound,
        current_expected_tat_lower_bound=state.current_expected_tat_lower_bound,
        current_max_path_cost=state.current_max_path_cost,
        current_max_path_tat=state.current_max_path_tat,
        resolved_positive_mass_disease=state.resolved_positive_mass_disease,
        resolved_negative_mass_disease=state.resolved_negative_mass_disease,
        unresolved_mass_disease=state.unresolved_mass_disease,
        resolved_positive_mass_no_disease=state.resolved_positive_mass_no_disease,
        resolved_negative_mass_no_disease=state.resolved_negative_mass_no_disease,
        unresolved_mass_no_disease=state.unresolved_mass_no_disease,
        sensitivity_upper_bound=state.sensitivity_upper_bound,
        specificity_upper_bound=state.specificity_upper_bound,
        canonical_signature=state.canonical_signature,
        search_trace=dict(state.search_trace),
    )


def _allocate_aliases(counts: Dict[str, int], base_test_ids: Iterable[str]) -> Dict[str, Any] | None:
    next_counts = dict(counts)
    aliases: list[str] = []
    for base_test_id in base_test_ids:
        count = int(next_counts.get(base_test_id, 0)) + 1
        next_counts[base_test_id] = count
        aliases.append(base_test_id if count == 1 else f'{base_test_id}__{count}')
    return {'counts': next_counts, 'aliases': aliases}


def _tool_payload(tool: DiagnosticTool, invocation_id: str, base_test_id: str) -> Dict[str, Any]:
    return {
        'id': invocation_id,
        'name': tool.name,
        'sensitivity': tool.sensitivity,
        'specificity': tool.specificity,
        'turnaround_time': tool.turnaround_time,
        'turnaround_time_unit': tool.turnaround_time_unit,
        'sample_types': list(tool.sample_types),
        'skill_level': tool.skill_level,
        'cost': tool.cost,
        'requires_lab_technician': tool.requires_lab_technician,
        'requires_radiologist': tool.requires_radiologist,
        'requires_specialist_physician': tool.requires_specialist_physician,
        'sample_none': tool.sample_none,
        'sample_blood': tool.sample_blood,
        'sample_urine': tool.sample_urine,
        'sample_stool': tool.sample_stool,
        'sample_sputum': tool.sample_sputum,
        'sample_nasal_swab': tool.sample_nasal_swab,
        'sample_imaging': tool.sample_imaging,
        'base_test_id': base_test_id,
        'invocation_id': invocation_id,
        'is_repeat_invocation': invocation_id != base_test_id,
        'joint_probabilities': tool.joint_probabilities,
    }


def _node_tat(tools: Iterable[DiagnosticTool], mode: str) -> float:
    values = [float(tool.turnaround_time or 0.0) for tool in tools]
    if not values:
        return 0.0
    return max(values) if mode == 'parallel' else sum(values)


def _node_cost(tools: Iterable[DiagnosticTool]) -> float:
    return sum(float(tool.cost or 0.0) for tool in tools)


def _population_weight(prevalence: float, disease_mass: float, no_disease_mass: float) -> float:
    return prevalence * disease_mass + (1.0 - prevalence) * no_disease_mass


def _merge_requirements(state: SearchState, tools: Iterable[DiagnosticTool]) -> None:
    roles = set(state.current_required_skill_roles)
    samples = set(state.current_sample_types)
    for tool in tools:
        roles.update(tool_required_roles(tool))
        for sample_flag, enabled in tool_sample_flags(tool).items():
            if enabled:
                samples.add(sample_flag)
    state.current_required_skill_roles = tuple(sorted(roles))
    state.current_sample_types = tuple(sorted(samples))


def _finalize_branch(state: SearchState, disease_mass: float, no_disease_mass: float, classification: str, path_cost: float, path_tat: float) -> None:
    if classification == 'positive':
        state.resolved_positive_mass_disease += disease_mass
        state.resolved_positive_mass_no_disease += no_disease_mass
    else:
        state.resolved_negative_mass_disease += disease_mass
        state.resolved_negative_mass_no_disease += no_disease_mass
    state.current_max_path_cost = max(state.current_max_path_cost, path_cost)
    state.current_max_path_tat = max(state.current_max_path_tat, path_tat)


def _add_unresolved_leaf(state: SearchState, leaf: SearchLeaf) -> None:
    state.unresolved_leaves.append(leaf)
    state.tests_used_on_each_realized_path.append(leaf.tests_used_on_path)


def _probabilities(tool: DiagnosticTool) -> Dict[str, Dict[str, float]]:
    return {
        'D': {'pos': float(tool.sensitivity), 'neg': 1.0 - float(tool.sensitivity)},
        'ND': {'pos': 1.0 - float(tool.specificity), 'neg': float(tool.specificity)},
    }


def _apply_single(state: SearchState, leaf: SearchLeaf, base_test_ids: List[str], aliases: List[str], tests: Dict[str, DiagnosticTool], prevalence: float, config: OptimizerConfig) -> bool:
    tool = tests[base_test_ids[0]]
    probs = _probabilities(tool)
    state.partial_pathway_graph[leaf.node_id] = {
        'action': {'test_names': aliases, 'mode': 'sequential', 'parallel_time': False},
        'branches': [
            {'conditions': {aliases[0]: 'pos'}, 'next_node': 'final_positive'},
            {'conditions': {aliases[0]: 'neg'}, 'next_node': 'final_negative'},
        ],
    }
    _merge_requirements(state, [tool])
    pop_weight = _population_weight(prevalence, leaf.disease_mass, leaf.no_disease_mass)
    node_cost = _node_cost([tool])
    node_tat = _node_tat([tool], 'sequential')
    state.current_expected_cost_lower_bound += pop_weight * node_cost
    state.current_expected_tat_lower_bound += pop_weight * node_tat
    _finalize_branch(state, leaf.disease_mass * probs['D']['pos'], leaf.no_disease_mass * probs['ND']['pos'], 'positive', leaf.current_path_cost + node_cost, leaf.current_path_tat + node_tat)
    _finalize_branch(state, leaf.disease_mass * probs['D']['neg'], leaf.no_disease_mass * probs['ND']['neg'], 'negative', leaf.current_path_cost + node_cost, leaf.current_path_tat + node_tat)
    return True


def _apply_serial_confirm(state: SearchState, leaf: SearchLeaf, base_test_ids: List[str], aliases: List[str], tests: Dict[str, DiagnosticTool], prevalence: float, config: OptimizerConfig) -> bool:
    first_tool = tests[base_test_ids[0]]
    second_tool = tests[base_test_ids[1]]
    first_probs = _probabilities(first_tool)
    second_probs = _probabilities(second_tool)
    confirm_node = _next_node_id(state, 'confirm')
    state.partial_pathway_graph[leaf.node_id] = {
        'action': {'test_names': [aliases[0]], 'mode': 'sequential', 'parallel_time': False},
        'branches': [
            {'conditions': {aliases[0]: 'pos'}, 'next_node': confirm_node},
            {'conditions': {aliases[0]: 'neg'}, 'next_node': 'final_negative'},
        ],
    }
    state.partial_pathway_graph[confirm_node] = {
        'action': {'test_names': [aliases[1]], 'mode': 'sequential', 'parallel_time': False},
        'branches': [
            {'conditions': {aliases[1]: 'pos'}, 'next_node': 'final_positive'},
            {'conditions': {aliases[1]: 'neg'}, 'next_node': 'final_negative'},
        ],
    }
    _merge_requirements(state, [first_tool, second_tool])
    first_weight = _population_weight(prevalence, leaf.disease_mass, leaf.no_disease_mass)
    confirm_weight = _population_weight(
        prevalence,
        leaf.disease_mass * first_probs['D']['pos'],
        leaf.no_disease_mass * first_probs['ND']['pos'],
    )
    first_cost = _node_cost([first_tool])
    second_cost = _node_cost([second_tool])
    first_tat = _node_tat([first_tool], 'sequential')
    second_tat = _node_tat([second_tool], 'sequential')
    state.current_expected_cost_lower_bound += first_weight * first_cost + confirm_weight * second_cost
    state.current_expected_tat_lower_bound += first_weight * first_tat + confirm_weight * second_tat
    _finalize_branch(state, leaf.disease_mass * first_probs['D']['neg'], leaf.no_disease_mass * first_probs['ND']['neg'], 'negative', leaf.current_path_cost + first_cost, leaf.current_path_tat + first_tat)
    _finalize_branch(state, leaf.disease_mass * first_probs['D']['pos'] * second_probs['D']['pos'], leaf.no_disease_mass * first_probs['ND']['pos'] * second_probs['ND']['pos'], 'positive', leaf.current_path_cost + first_cost + second_cost, leaf.current_path_tat + first_tat + second_tat)
    _finalize_branch(state, leaf.disease_mass * first_probs['D']['pos'] * second_probs['D']['neg'], leaf.no_disease_mass * first_probs['ND']['pos'] * second_probs['ND']['neg'], 'negative', leaf.current_path_cost + first_cost + second_cost, leaf.current_path_tat + first_tat + second_tat)
    return True


def _apply_serial_rescue(state: SearchState, leaf: SearchLeaf, base_test_ids: List[str], aliases: List[str], tests: Dict[str, DiagnosticTool], prevalence: float, config: OptimizerConfig) -> bool:
    first_tool = tests[base_test_ids[0]]
    second_tool = tests[base_test_ids[1]]
    first_probs = _probabilities(first_tool)
    second_probs = _probabilities(second_tool)
    rescue_node = _next_node_id(state, 'rescue')
    state.partial_pathway_graph[leaf.node_id] = {
        'action': {'test_names': [aliases[0]], 'mode': 'sequential', 'parallel_time': False},
        'branches': [
            {'conditions': {aliases[0]: 'pos'}, 'next_node': 'final_positive'},
            {'conditions': {aliases[0]: 'neg'}, 'next_node': rescue_node},
        ],
    }
    state.partial_pathway_graph[rescue_node] = {
        'action': {'test_names': [aliases[1]], 'mode': 'sequential', 'parallel_time': False},
        'branches': [
            {'conditions': {aliases[1]: 'pos'}, 'next_node': 'final_positive'},
            {'conditions': {aliases[1]: 'neg'}, 'next_node': 'final_negative'},
        ],
    }
    _merge_requirements(state, [first_tool, second_tool])
    first_weight = _population_weight(prevalence, leaf.disease_mass, leaf.no_disease_mass)
    rescue_weight = _population_weight(
        prevalence,
        leaf.disease_mass * first_probs['D']['neg'],
        leaf.no_disease_mass * first_probs['ND']['neg'],
    )
    first_cost = _node_cost([first_tool])
    second_cost = _node_cost([second_tool])
    first_tat = _node_tat([first_tool], 'sequential')
    second_tat = _node_tat([second_tool], 'sequential')
    state.current_expected_cost_lower_bound += first_weight * first_cost + rescue_weight * second_cost
    state.current_expected_tat_lower_bound += first_weight * first_tat + rescue_weight * second_tat
    _finalize_branch(state, leaf.disease_mass * first_probs['D']['pos'], leaf.no_disease_mass * first_probs['ND']['pos'], 'positive', leaf.current_path_cost + first_cost, leaf.current_path_tat + first_tat)
    _finalize_branch(state, leaf.disease_mass * first_probs['D']['neg'] * second_probs['D']['pos'], leaf.no_disease_mass * first_probs['ND']['neg'] * second_probs['ND']['pos'], 'positive', leaf.current_path_cost + first_cost + second_cost, leaf.current_path_tat + first_tat + second_tat)
    _finalize_branch(state, leaf.disease_mass * first_probs['D']['neg'] * second_probs['D']['neg'], leaf.no_disease_mass * first_probs['ND']['neg'] * second_probs['ND']['neg'], 'negative', leaf.current_path_cost + first_cost + second_cost, leaf.current_path_tat + first_tat + second_tat)
    return True


def _apply_parallel_or(state: SearchState, leaf: SearchLeaf, base_test_ids: List[str], aliases: List[str], tests: Dict[str, DiagnosticTool], prevalence: float, config: OptimizerConfig) -> bool:
    return _apply_parallel_terminal(state, leaf, base_test_ids, aliases, tests, prevalence, operator='or')


def _apply_parallel_and(state: SearchState, leaf: SearchLeaf, base_test_ids: List[str], aliases: List[str], tests: Dict[str, DiagnosticTool], prevalence: float, config: OptimizerConfig) -> bool:
    return _apply_parallel_terminal(state, leaf, base_test_ids, aliases, tests, prevalence, operator='and')


def _apply_parallel_terminal(state: SearchState, leaf: SearchLeaf, base_test_ids: List[str], aliases: List[str], tests: Dict[str, DiagnosticTool], prevalence: float, operator: str) -> bool:
    tools = [tests[test_id] for test_id in base_test_ids]
    state.partial_pathway_graph[leaf.node_id] = {
        'action': {'test_names': aliases, 'mode': 'parallel', 'parallel_time': True},
        'branches': [],
    }
    _merge_requirements(state, tools)
    pop_weight = _population_weight(prevalence, leaf.disease_mass, leaf.no_disease_mass)
    node_cost = _node_cost(tools)
    node_tat = _node_tat(tools, 'parallel')
    state.current_expected_cost_lower_bound += pop_weight * node_cost
    state.current_expected_tat_lower_bound += pop_weight * node_tat
    for outcome in _outcome_combinations(aliases):
        disease_mass = leaf.disease_mass
        no_disease_mass = leaf.no_disease_mass
        for alias, base_test_id in zip(aliases, base_test_ids):
            tool_probs = _probabilities(tests[base_test_id])
            disease_mass *= tool_probs['D'][outcome[alias]]
            no_disease_mass *= tool_probs['ND'][outcome[alias]]
        any_positive = any(result == 'pos' for result in outcome.values())
        all_positive = all(result == 'pos' for result in outcome.values())
        classification = 'positive' if (any_positive if operator == 'or' else all_positive) else 'negative'
        next_node = 'final_positive' if classification == 'positive' else 'final_negative'
        state.partial_pathway_graph[leaf.node_id]['branches'].append({'conditions': dict(outcome), 'next_node': next_node})
        _finalize_branch(state, disease_mass, no_disease_mass, classification, leaf.current_path_cost + node_cost, leaf.current_path_tat + node_tat)
    return True


def _apply_discordant_referee(state: SearchState, leaf: SearchLeaf, base_test_ids: List[str], aliases: List[str], tests: Dict[str, DiagnosticTool], prevalence: float, config: OptimizerConfig) -> bool:
    pair_aliases = aliases[:2]
    pair_bases = base_test_ids[:2]
    referee_alias = aliases[2]
    referee_base = base_test_ids[2]
    referee_node = _next_node_id(state, 'referee')
    pair_tools = [tests[test_id] for test_id in pair_bases]
    referee_tool = tests[referee_base]
    state.partial_pathway_graph[leaf.node_id] = {
        'action': {'test_names': pair_aliases, 'mode': 'parallel', 'parallel_time': True},
        'branches': [
            {'conditions': {pair_aliases[0]: 'pos', pair_aliases[1]: 'pos'}, 'next_node': 'final_positive'},
            {'conditions': {pair_aliases[0]: 'neg', pair_aliases[1]: 'neg'}, 'next_node': 'final_negative'},
            {'conditions': {pair_aliases[0]: 'pos', pair_aliases[1]: 'neg'}, 'next_node': referee_node},
            {'conditions': {pair_aliases[0]: 'neg', pair_aliases[1]: 'pos'}, 'next_node': referee_node},
        ],
    }
    state.partial_pathway_graph[referee_node] = {
        'action': {'test_names': [referee_alias], 'mode': 'sequential', 'parallel_time': False},
        'branches': [
            {'conditions': {referee_alias: 'pos'}, 'next_node': 'final_positive'},
            {'conditions': {referee_alias: 'neg'}, 'next_node': 'final_negative'},
        ],
    }
    _merge_requirements(state, pair_tools + [referee_tool])
    pair_weight = _population_weight(prevalence, leaf.disease_mass, leaf.no_disease_mass)
    pair_cost = _node_cost(pair_tools)
    pair_tat = _node_tat(pair_tools, 'parallel')
    state.current_expected_cost_lower_bound += pair_weight * pair_cost
    state.current_expected_tat_lower_bound += pair_weight * pair_tat

    pair_outcomes = _outcome_combinations(pair_aliases)
    referee_probs = _probabilities(referee_tool)
    discordant_disease_mass = 0.0
    discordant_no_disease_mass = 0.0
    for outcome in pair_outcomes:
        disease_mass = leaf.disease_mass
        no_disease_mass = leaf.no_disease_mass
        for alias, base_test_id in zip(pair_aliases, pair_bases):
            tool_probs = _probabilities(tests[base_test_id])
            disease_mass *= tool_probs['D'][outcome[alias]]
            no_disease_mass *= tool_probs['ND'][outcome[alias]]
        if outcome[pair_aliases[0]] == outcome[pair_aliases[1]] == 'pos':
            _finalize_branch(state, disease_mass, no_disease_mass, 'positive', leaf.current_path_cost + pair_cost, leaf.current_path_tat + pair_tat)
        elif outcome[pair_aliases[0]] == outcome[pair_aliases[1]] == 'neg':
            _finalize_branch(state, disease_mass, no_disease_mass, 'negative', leaf.current_path_cost + pair_cost, leaf.current_path_tat + pair_tat)
        else:
            discordant_disease_mass += disease_mass
            discordant_no_disease_mass += no_disease_mass

    referee_weight = _population_weight(prevalence, discordant_disease_mass, discordant_no_disease_mass)
    referee_cost = _node_cost([referee_tool])
    referee_tat = _node_tat([referee_tool], 'sequential')
    state.current_expected_cost_lower_bound += referee_weight * referee_cost
    state.current_expected_tat_lower_bound += referee_weight * referee_tat
    _finalize_branch(state, discordant_disease_mass * referee_probs['D']['pos'], discordant_no_disease_mass * referee_probs['ND']['pos'], 'positive', leaf.current_path_cost + pair_cost + referee_cost, leaf.current_path_tat + pair_tat + referee_tat)
    _finalize_branch(state, discordant_disease_mass * referee_probs['D']['neg'], discordant_no_disease_mass * referee_probs['ND']['neg'], 'negative', leaf.current_path_cost + pair_cost + referee_cost, leaf.current_path_tat + pair_tat + referee_tat)
    return True


def _apply_triage_positive_continue(state: SearchState, leaf: SearchLeaf, base_test_ids: List[str], aliases: List[str], tests: Dict[str, DiagnosticTool], prevalence: float, config: OptimizerConfig) -> bool:
    return _apply_triage_continue(state, leaf, base_test_ids[0], aliases[0], tests, prevalence, continue_on='pos')


def _apply_triage_negative_continue(state: SearchState, leaf: SearchLeaf, base_test_ids: List[str], aliases: List[str], tests: Dict[str, DiagnosticTool], prevalence: float, config: OptimizerConfig) -> bool:
    return _apply_triage_continue(state, leaf, base_test_ids[0], aliases[0], tests, prevalence, continue_on='neg')


def _apply_triage_continue(state: SearchState, leaf: SearchLeaf, base_test_id: str, alias: str, tests: Dict[str, DiagnosticTool], prevalence: float, continue_on: str) -> bool:
    tool = tests[base_test_id]
    probs = _probabilities(tool)
    unresolved_node = _next_node_id(state, 'continue')
    resolved_outcome = 'neg' if continue_on == 'pos' else 'pos'
    resolved_next = 'final_negative' if resolved_outcome == 'neg' else 'final_positive'
    state.partial_pathway_graph[leaf.node_id] = {
        'action': {'test_names': [alias], 'mode': 'sequential', 'parallel_time': False},
        'branches': [
            {'conditions': {alias: continue_on}, 'next_node': unresolved_node},
            {'conditions': {alias: resolved_outcome}, 'next_node': resolved_next},
        ],
    }
    _merge_requirements(state, [tool])
    pop_weight = _population_weight(prevalence, leaf.disease_mass, leaf.no_disease_mass)
    node_cost = _node_cost([tool])
    node_tat = _node_tat([tool], 'sequential')
    state.current_expected_cost_lower_bound += pop_weight * node_cost
    state.current_expected_tat_lower_bound += pop_weight * node_tat
    _finalize_branch(
        state,
        leaf.disease_mass * probs['D'][resolved_outcome],
        leaf.no_disease_mass * probs['ND'][resolved_outcome],
        'negative' if resolved_outcome == 'neg' else 'positive',
        leaf.current_path_cost + node_cost,
        leaf.current_path_tat + node_tat,
    )
    _add_unresolved_leaf(
        state,
        SearchLeaf(
            node_id=unresolved_node,
            disease_mass=leaf.disease_mass * probs['D'][continue_on],
            no_disease_mass=leaf.no_disease_mass * probs['ND'][continue_on],
            stage_count=leaf.stage_count + 1,
            tests_used_on_path=leaf.tests_used_on_path + (base_test_id,),
            current_path_cost=leaf.current_path_cost + node_cost,
            current_path_tat=leaf.current_path_tat + node_tat,
        ),
    )
    return True


def _next_node_id(state: SearchState, prefix: str) -> str:
    next_index = int(state.search_trace.get('next_node_index', 1))
    state.search_trace['next_node_index'] = next_index + 1
    return f'{prefix}_{next_index}'


def _outcome_combinations(test_names: List[str]) -> List[Dict[str, str]]:
    outcomes: List[Dict[str, str]] = []

    def expand(index: int, current: Dict[str, str]) -> None:
        if index >= len(test_names):
            outcomes.append(dict(current))
            return
        test_name = test_names[index]
        current[test_name] = 'pos'
        expand(index + 1, current)
        current[test_name] = 'neg'
        expand(index + 1, current)
        current.pop(test_name, None)

    expand(0, {})
    return outcomes
