from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple
import json

ResultLabel = str
FinalLabel = str
DiseaseState = str  # 'D' or 'ND'


@dataclass
class DiagnosticTest:
    name: str
    sensitivity: float
    specificity: float
    turnaround_time: Optional[float] = None
    turnaround_time_unit: Optional[str] = None
    sample_types: List[str] = field(default_factory=list)
    skill_level: Optional[int] = None
    cost: Optional[float] = None
    joint_probabilities: Dict[DiseaseState, Dict[Tuple[Tuple[str, str], ...], float]] = field(default_factory=dict)
    requires_lab_technician: bool = False
    requires_radiologist: bool = False
    requires_specialist_physician: bool = False
    sample_none: bool = False
    sample_blood: bool = False
    sample_urine: bool = False
    sample_stool: bool = False
    sample_sputum: bool = False
    sample_nasal_swab: bool = False
    sample_imaging: bool = False
    base_test_id: Optional[str] = None
    invocation_id: Optional[str] = None
    is_repeat_invocation: bool = False

    def turnaround_time_hours(self) -> float:
        if self.turnaround_time is None:
            return 0.0

        unit = (self.turnaround_time_unit or 'hr').strip().lower()
        value = float(self.turnaround_time)

        if unit in {'min', 'minute', 'minutes'}:
            return value / 60.0
        if unit in {'hr', 'hour', 'hours', 'h'}:
            return value
        if unit in {'day', 'days', 'd'}:
            return value * 24.0
        if unit in {'week', 'weeks', 'w'}:
            return value * 168.0

        return value

    def outcome_probability_independent(self, outcome: ResultLabel, disease_state: DiseaseState) -> float:
        if disease_state == 'D':
            return self.sensitivity if outcome == 'pos' else 1.0 - self.sensitivity
        if disease_state == 'ND':
            return 1.0 - self.specificity if outcome == 'pos' else self.specificity
        raise ValueError(f'Unknown disease_state: {disease_state}')

    def normalized_role_flags(self) -> Dict[str, bool]:
        if any([self.requires_lab_technician, self.requires_radiologist, self.requires_specialist_physician]):
            return {
                'lab_technician': self.requires_lab_technician,
                'radiologist': self.requires_radiologist,
                'specialist_physician': self.requires_specialist_physician,
            }

        skill = self.skill_level or 0
        if skill <= 0:
            return {
                'lab_technician': False,
                'radiologist': False,
                'specialist_physician': False,
            }
        if skill == 1:
            return {
                'lab_technician': True,
                'radiologist': False,
                'specialist_physician': False,
            }
        if skill == 2:
            return {
                'lab_technician': False,
                'radiologist': True,
                'specialist_physician': False,
            }

        return {
            'lab_technician': False,
            'radiologist': False,
            'specialist_physician': True,
        }

    def normalized_sample_flags(self) -> Dict[str, bool]:
        sample_types = {str(sample).strip().lower() for sample in self.sample_types if str(sample).strip()}
        if self.sample_none:
            sample_types.add('none')
        if self.sample_blood:
            sample_types.add('blood')
        if self.sample_urine:
            sample_types.add('urine')
        if self.sample_stool:
            sample_types.add('stool')
        if self.sample_sputum:
            sample_types.add('sputum')
        if self.sample_nasal_swab:
            sample_types.add('nasal swab')
        if self.sample_imaging:
            sample_types.add('imaging')

        return {
            'none': 'none' in sample_types or sample_types == set(),
            'blood': any(sample in sample_types for sample in {'blood', 'serum', 'plasma', 'fingerstick'}),
            'urine': 'urine' in sample_types,
            'stool': any(sample in sample_types for sample in {'stool', 'feces', 'faeces'}),
            'sputum': 'sputum' in sample_types,
            'nasal_swab': any(sample in sample_types for sample in {'nasal swab', 'nasopharyngeal swab', 'swab'}),
            'imaging': any(sample in sample_types for sample in {'imaging', 'x-ray', 'xray', 'ct', 'mri', 'ultrasound', 'radiograph'}),
        }


@dataclass
class Action:
    test_names: List[str]
    mode: str = 'parallel'
    parallel_time: bool = False


@dataclass
class Branch:
    conditions: Dict[str, ResultLabel]
    next_node: str


@dataclass
class Node:
    node_id: str
    action: Optional[Action] = None
    branches: List[Branch] = field(default_factory=list)
    final_classification: Optional[FinalLabel] = None
    description: Optional[str] = None


@dataclass
class PathEvaluation:
    terminal_node: str
    final_classification: FinalLabel
    outcomes: Dict[str, ResultLabel]
    probability: float
    turnaround_time: float
    sample_types: List[str]
    skill_level: int
    cost: float


@dataclass
class BenchmarkCase:
    case_id: str
    title: str
    disease_area: str
    citation: str
    expected_metrics: Dict[str, float]
    notes: str = ''


class DiagnosticPathwayEngine:
    def __init__(self, tests: Dict[str, DiagnosticTest], nodes: Dict[str, Node], start_node: str):
        self.tests = tests
        self.nodes = nodes
        self.start_node = start_node
        self._validate_graph()

    def _validate_graph(self) -> None:
        if self.start_node not in self.nodes:
            raise ValueError(f"Start node '{self.start_node}' is missing")
        for node in self.nodes.values():
            if node.final_classification is None and node.action is None:
                raise ValueError(f"Node '{node.node_id}' must have either action or final classification")
            if node.action is not None:
                for test_name in node.action.test_names:
                    if test_name not in self.tests:
                        raise ValueError(f"Node '{node.node_id}' references missing test '{test_name}'")
                self._validate_branch_exclusivity(node)
            for branch in node.branches:
                if branch.next_node not in self.nodes:
                    raise ValueError(f"Branch target '{branch.next_node}' missing from graph")

        visiting: set[str] = set()
        visited: set[str] = set()

        def visit(node_id: str) -> bool:
            if node_id in visiting:
                return True
            if node_id in visited:
                return False

            visiting.add(node_id)
            for branch in self.nodes[node_id].branches:
                if visit(branch.next_node):
                    return True
            visiting.remove(node_id)
            visited.add(node_id)
            return False

        if visit(self.start_node):
            raise ValueError('Pathway contains a cycle')

        reachable = self.enumerate_paths('D')
        if not any(path.final_classification == 'positive' for path in reachable):
            raise ValueError('Pathway must include at least one positive terminal')
        if not any(path.final_classification == 'negative' for path in reachable):
            raise ValueError('Pathway must include at least one negative terminal')

    def _validate_branch_exclusivity(self, node: Node) -> None:
        if node.action is None:
            return

        test_names = list(node.action.test_names)
        if not test_names:
            raise ValueError(f"Node '{node.node_id}' must include at least one test when it has an action")

        for outcome in self._all_outcome_dicts(test_names):
            matches = [
                branch for branch in node.branches
                if all(outcome.get(test_name) == result for test_name, result in branch.conditions.items())
            ]
            if len(matches) != 1:
                raise ValueError(
                    f"Node '{node.node_id}' must have exactly one matching branch for outcome {outcome}; got {len(matches)}"
                )

    @staticmethod
    def _all_outcome_dicts(test_names: List[str]) -> List[Dict[str, ResultLabel]]:
        results: List[Dict[str, ResultLabel]] = []

        def expand(index: int, current: Dict[str, ResultLabel]) -> None:
            if index >= len(test_names):
                results.append(dict(current))
                return

            test_name = test_names[index]
            current[test_name] = 'pos'
            expand(index + 1, current)
            current[test_name] = 'neg'
            expand(index + 1, current)
            current.pop(test_name, None)

        expand(0, {})
        return results

    @staticmethod
    def _sorted_key(outcomes: Dict[str, ResultLabel]) -> Tuple[Tuple[str, str], ...]:
        return tuple(sorted(outcomes.items(), key=lambda x: x[0]))

    def _joint_probability_lookup(self, disease_state: DiseaseState, outcomes_subset: Dict[str, ResultLabel]) -> Optional[float]:
        key = self._sorted_key(outcomes_subset)
        for test_name in outcomes_subset:
            test = self.tests[test_name]
            prob = test.joint_probabilities.get(disease_state, {}).get(key)
            if prob is not None:
                return prob
        return None

    def _conditional_probability_for_new_tests(
        self,
        previous_outcomes: Dict[str, ResultLabel],
        new_outcomes: Dict[str, ResultLabel],
        disease_state: DiseaseState,
    ) -> float:
        combined = {**previous_outcomes, **new_outcomes}

        if previous_outcomes:
            joint_num = self._joint_probability_lookup(disease_state, combined)
            joint_den = self._joint_probability_lookup(disease_state, previous_outcomes)
            if joint_num is not None and joint_den is not None:
                if joint_den <= 0:
                    return 0.0
                return joint_num / joint_den
        else:
            joint = self._joint_probability_lookup(disease_state, new_outcomes)
            if joint is not None:
                return joint

        prob = 1.0
        for test_name, outcome in new_outcomes.items():
            prob *= self.tests[test_name].outcome_probability_independent(outcome, disease_state)
        return prob

    def _node_turnaround(self, node: Node) -> float:
        if node.action is None:
            return 0.0
        times = [self.tests[t].turnaround_time_hours() for t in node.action.test_names]
        return (max(times) if node.action.parallel_time else sum(times)) if times else 0.0

    def _node_cost(self, node: Node) -> float:
        if node.action is None:
            return 0.0
        return sum(self.tests[t].cost or 0.0 for t in node.action.test_names)

    def _node_sample_union(self, node: Node) -> List[str]:
        if node.action is None:
            return []
        samples: List[str] = []
        seen = set()
        for t in node.action.test_names:
            for s in self.tests[t].sample_types:
                if s not in seen:
                    seen.add(s)
                    samples.append(s)
        return samples

    def _node_skill(self, node: Node) -> int:
        if node.action is None:
            return 0
        return max((self.tests[t].skill_level or 0) for t in node.action.test_names)

    def _node_roles(self, node: Node) -> Dict[str, bool]:
        if node.action is None:
            return {
                'lab_technician': False,
                'radiologist': False,
                'specialist_physician': False,
            }

        roles = {
            'lab_technician': False,
            'radiologist': False,
            'specialist_physician': False,
        }
        for test_name in node.action.test_names:
            test_roles = self.tests[test_name].normalized_role_flags()
            for key, value in test_roles.items():
                roles[key] = roles[key] or value
        return roles

    def _node_sample_flags(self, node: Node) -> Dict[str, bool]:
        if node.action is None:
            return {
                'none': False,
                'blood': False,
                'urine': False,
                'stool': False,
                'sputum': False,
                'nasal_swab': False,
                'imaging': False,
            }

        flags = {
            'none': False,
            'blood': False,
            'urine': False,
            'stool': False,
            'sputum': False,
            'nasal_swab': False,
            'imaging': False,
        }
        for test_name in node.action.test_names:
            test_flags = self.tests[test_name].normalized_sample_flags()
            for key, value in test_flags.items():
                flags[key] = flags[key] or value
        return flags

    def enumerate_paths(self, disease_state: DiseaseState) -> List[PathEvaluation]:
        results: List[PathEvaluation] = []

        def walk(
            node_id: str,
            outcomes: Dict[str, ResultLabel],
            path_prob: float,
            tat: float,
            sample_types: List[str],
            skill_level: int,
            cost: float,
        ) -> None:
            node = self.nodes[node_id]
            if node.final_classification is not None:
                results.append(
                    PathEvaluation(
                        terminal_node=node_id,
                        final_classification=node.final_classification,
                        outcomes=dict(outcomes),
                        probability=path_prob,
                        turnaround_time=tat,
                        sample_types=sample_types.copy(),
                        skill_level=skill_level,
                        cost=cost,
                    )
                )
                return

            assert node.action is not None
            current_tests = node.action.test_names

            def recurse(idx: int, acc: Dict[str, ResultLabel]) -> None:
                if idx == len(current_tests):
                    cond_prob = self._conditional_probability_for_new_tests(outcomes, acc, disease_state)
                    new_prob = path_prob * cond_prob
                    new_outcomes = {**outcomes, **acc}
                    new_tat = tat + self._node_turnaround(node)
                    new_cost = cost + self._node_cost(node)
                    new_samples = sample_types.copy()
                    for s in self._node_sample_union(node):
                        if s not in new_samples:
                            new_samples.append(s)
                    new_skill = max(skill_level, self._node_skill(node))

                    matched = False
                    for branch in node.branches:
                        if all(new_outcomes.get(t) == r for t, r in branch.conditions.items()):
                            matched = True
                            walk(branch.next_node, new_outcomes, new_prob, new_tat, new_samples, new_skill, new_cost)
                    if not matched:
                        raise ValueError(f"No branch matched at node '{node.node_id}' for outcomes {new_outcomes}")
                    return

                test_name = current_tests[idx]
                for outcome in ('pos', 'neg'):
                    acc[test_name] = outcome
                    recurse(idx + 1, acc)
                acc.pop(test_name, None)

            recurse(0, {})

        walk(self.start_node, {}, 1.0, 0.0, [], 0, 0.0)
        return results

    def aggregate_metrics(self, prevalence: Optional[float] = None) -> Dict[str, Any]:
        paths_d = self.enumerate_paths('D')
        paths_nd = self.enumerate_paths('ND')
        all_paths = paths_d + paths_nd

        sensitivity = sum(p.probability for p in paths_d if p.final_classification == 'positive')
        specificity = sum(p.probability for p in paths_nd if p.final_classification == 'negative')
        expected_tests_given_disease = sum(p.probability * len(p.outcomes) for p in paths_d)
        expected_tests_given_no_disease = sum(p.probability * len(p.outcomes) for p in paths_nd)
        max_path_cost = max([p.cost for p in all_paths] + [0.0])
        max_path_turnaround_time = max([p.turnaround_time for p in all_paths] + [0.0])

        metrics: Dict[str, Any] = {
            'sensitivity': sensitivity,
            'specificity': specificity,
            'false_negative_rate': 1.0 - sensitivity,
            'false_positive_rate': 1.0 - specificity,
            'ppv': None,
            'npv': None,
            'balanced_accuracy': (sensitivity + specificity) / 2.0,
            'youden_j': sensitivity + specificity - 1.0,
            'expected_turnaround_time_given_disease': sum(p.probability * p.turnaround_time for p in paths_d),
            'expected_turnaround_time_given_no_disease': sum(p.probability * p.turnaround_time for p in paths_nd),
            'expected_cost_given_disease': sum(p.probability * p.cost for p in paths_d),
            'expected_cost_given_no_disease': sum(p.probability * p.cost for p in paths_nd),
            'expected_tests_given_disease': expected_tests_given_disease,
            'expected_tests_given_no_disease': expected_tests_given_no_disease,
            'max_skill_required': max([p.skill_level for p in (paths_d + paths_nd)] + [0]),
            'all_sample_types_required': sorted({s for p in (paths_d + paths_nd) for s in p.sample_types}),
            'paths_disease_present': [self._path_to_dict(p) for p in paths_d],
            'paths_disease_absent': [self._path_to_dict(p) for p in paths_nd],
            'max_path_cost': max_path_cost,
            'max_path_turnaround_time': max_path_turnaround_time,
            'warnings': [],
            'assumptions': [],
        }

        if prevalence is not None:
            if not 0.0 <= prevalence <= 1.0:
                raise ValueError('Prevalence must be between 0 and 1')
            denom_positive = prevalence * sensitivity + (1.0 - prevalence) * (1.0 - specificity)
            denom_negative = (1.0 - prevalence) * specificity + prevalence * (1.0 - sensitivity)
            probability_algorithm_positive = prevalence * sensitivity + (1.0 - prevalence) * (1.0 - specificity)
            probability_algorithm_negative = prevalence * (1.0 - sensitivity) + (1.0 - prevalence) * specificity
            true_positive_rate = prevalence * sensitivity
            true_negative_rate = (1.0 - prevalence) * specificity
            false_positive_rate_population = (1.0 - prevalence) * (1.0 - specificity)
            false_negative_rate_population = prevalence * (1.0 - sensitivity)
            expected_cost_population = (
                prevalence * metrics['expected_cost_given_disease']
                + (1.0 - prevalence) * metrics['expected_cost_given_no_disease']
            )
            expected_turnaround_time_population = (
                prevalence * metrics['expected_turnaround_time_given_disease']
                + (1.0 - prevalence) * metrics['expected_turnaround_time_given_no_disease']
            )
            metrics['ppv'] = (prevalence * sensitivity / denom_positive) if denom_positive > 0 else 0.0
            metrics['npv'] = ((1.0 - prevalence) * specificity / denom_negative) if denom_negative > 0 else 0.0
            metrics['expected_turnaround_time_population'] = expected_turnaround_time_population
            metrics['expected_cost_population'] = expected_cost_population
            metrics['expected_tests_population'] = (
                prevalence * expected_tests_given_disease + (1.0 - prevalence) * expected_tests_given_no_disease
            )
            metrics['expected_true_positives_per_1000'] = 1000.0 * true_positive_rate
            metrics['expected_true_negatives_per_1000'] = 1000.0 * true_negative_rate
            metrics['expected_false_positives_per_1000'] = 1000.0 * false_positive_rate_population
            metrics['expected_false_negatives_per_1000'] = 1000.0 * false_negative_rate_population
            metrics['probability_algorithm_positive'] = probability_algorithm_positive
            metrics['probability_algorithm_negative'] = probability_algorithm_negative
            metrics['cost_per_positive_test'] = self._safe_divide(expected_cost_population, probability_algorithm_positive)
            metrics['cost_per_true_positive_detected'] = self._safe_divide(expected_cost_population, true_positive_rate)
            metrics['cost_per_correct_classification'] = self._safe_divide(
                expected_cost_population,
                true_positive_rate + true_negative_rate,
            )
        else:
            metrics['warnings'].append('Prevalence not provided; PPV, NPV, and population metrics omitted.')

        if any(test.joint_probabilities for test in self.tests.values()):
            metrics['assumptions'].append('Joint probabilities available for at least one test.')
        else:
            metrics['warnings'].append('No joint probabilities supplied; independence fallback may be used.')

        return metrics

    @staticmethod
    def _path_to_dict(path: PathEvaluation) -> Dict[str, Any]:
        return {
            'terminal_node': path.terminal_node,
            'final_classification': path.final_classification,
            'outcomes': path.outcomes,
            'probability': round(path.probability, 10),
            'turnaround_time': path.turnaround_time,
            'sample_types': path.sample_types,
            'skill_level': path.skill_level,
            'cost': path.cost,
        }

    @staticmethod
    def _safe_divide(numerator: float, denominator: float) -> float:
        if denominator <= 0:
            return 0.0
        return numerator / denominator

    @classmethod
    def from_dict(cls, payload: Dict[str, Any]) -> 'DiagnosticPathwayEngine':
        tests: Dict[str, DiagnosticTest] = {}
        raw_tests = payload['tests']
        if isinstance(raw_tests, list):
            raw_tests = {
                item.get('id') or item.get('name'): item
                for item in raw_tests
                if isinstance(item, dict) and (item.get('id') or item.get('name'))
            }
        for test_name, raw in raw_tests.items():
            joint_payload = raw.get('joint_probabilities', {})
            converted_joint: Dict[DiseaseState, Dict[Tuple[Tuple[str, str], ...], float]] = {}
            for state, entries in joint_payload.items():
                converted_joint[state] = {}
                for entry_key, value in entries.items():
                    if isinstance(entry_key, str):
                        parsed = tuple(tuple(item) for item in json.loads(entry_key))
                    else:
                        parsed = tuple(tuple(item) for item in entry_key)
                    converted_joint[state][parsed] = value
            tests[test_name] = DiagnosticTest(
                name=test_name,
                sensitivity=raw['sensitivity'],
                specificity=raw['specificity'],
                turnaround_time=raw.get('turnaround_time'),
                turnaround_time_unit=raw.get('turnaround_time_unit'),
                sample_types=raw.get('sample_types', []),
                skill_level=raw.get('skill_level'),
                cost=raw.get('cost'),
                joint_probabilities=converted_joint,
                requires_lab_technician=bool(raw.get('requires_lab_technician', False)),
                requires_radiologist=bool(raw.get('requires_radiologist', False)),
                requires_specialist_physician=bool(raw.get('requires_specialist_physician', False)),
                sample_none=bool(raw.get('sample_none', False)),
                sample_blood=bool(raw.get('sample_blood', False)),
                sample_urine=bool(raw.get('sample_urine', False)),
                sample_stool=bool(raw.get('sample_stool', False)),
                sample_sputum=bool(raw.get('sample_sputum', False)),
                sample_nasal_swab=bool(raw.get('sample_nasal_swab', False)),
                sample_imaging=bool(raw.get('sample_imaging', False)),
                base_test_id=raw.get('base_test_id'),
                invocation_id=raw.get('invocation_id'),
                is_repeat_invocation=bool(raw.get('is_repeat_invocation', False)),
            )

        nodes: Dict[str, Node] = {}
        raw_nodes = payload['nodes']
        if isinstance(raw_nodes, list):
            raw_nodes = {
                item.get('id') or item.get('node_id'): item
                for item in raw_nodes
                if isinstance(item, dict) and (item.get('id') or item.get('node_id'))
            }
        for node_id, raw in raw_nodes.items():
            action = None
            if raw.get('action') is not None:
                action = Action(
                    test_names=raw['action']['test_names'],
                    mode=raw['action'].get('mode', 'parallel'),
                    parallel_time=raw['action'].get('parallel_time', False),
                )
            nodes[node_id] = Node(
                node_id=node_id,
                action=action,
                branches=[Branch(conditions=b['conditions'], next_node=b['next_node']) for b in raw.get('branches', [])],
                final_classification=raw.get('final_classification'),
                description=raw.get('description'),
            )
        return cls(tests=tests, nodes=nodes, start_node=payload['start_node'])


class ValidationHarness:
    def __init__(self, tolerance: float = 0.02):
        self.tolerance = tolerance

    def compare_metric(self, predicted: float, observed: float, name: str) -> Dict[str, Any]:
        abs_error = abs(predicted - observed)
        rel_error = None if observed == 0 else abs_error / abs(observed)
        return {
            'metric': name,
            'predicted': predicted,
            'observed': observed,
            'absolute_error': abs_error,
            'relative_error': rel_error,
            'within_tolerance': abs_error <= self.tolerance,
        }

    def validate(self, predicted_metrics: Dict[str, Any], observed_metrics: Dict[str, float]) -> Dict[str, Any]:
        checks = []
        for metric_name, observed in observed_metrics.items():
            if metric_name in predicted_metrics:
                checks.append(self.compare_metric(predicted_metrics[metric_name], observed, metric_name))
        return {
            'passed': all(item['within_tolerance'] for item in checks) if checks else False,
            'checks': checks,
        }


def load_benchmark_cases(path: str | Path) -> List[BenchmarkCase]:
    raw = json.loads(Path(path).read_text())
    return [BenchmarkCase(**item) for item in raw]


def summarize_validation(results: Iterable[Dict[str, Any]]) -> Dict[str, Any]:
    checks = [c for result in results for c in result.get('checks', [])]
    if not checks:
        return {'n_checks': 0, 'mean_absolute_error': None, 'pass_rate': None}
    mae = sum(c['absolute_error'] for c in checks) / len(checks)
    pass_rate = sum(1 for c in checks if c['within_tolerance']) / len(checks)
    return {'n_checks': len(checks), 'mean_absolute_error': mae, 'pass_rate': pass_rate}
