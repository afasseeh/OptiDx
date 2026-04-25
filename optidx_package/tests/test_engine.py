import math
import pytest
from optidx.engine import Action, Branch, DiagnosticPathwayEngine, DiagnosticTest, Node, ValidationHarness


def build_independent_engine():
    tests = {
        'A': DiagnosticTest(name='A', sensitivity=0.90, specificity=0.80, turnaround_time=1, sample_types=['blood'], skill_level=1, cost=2),
        'B': DiagnosticTest(name='B', sensitivity=0.95, specificity=0.90, turnaround_time=3, sample_types=['swab'], skill_level=3, cost=8),
    }
    nodes = {
        'start': Node(
            node_id='start',
            action=Action(test_names=['A'], parallel_time=False),
            branches=[
                Branch(conditions={'A': 'pos'}, next_node='confirm'),
                Branch(conditions={'A': 'neg'}, next_node='final_negative'),
            ],
        ),
        'confirm': Node(
            node_id='confirm',
            action=Action(test_names=['B'], parallel_time=False),
            branches=[
                Branch(conditions={'B': 'pos'}, next_node='final_positive'),
                Branch(conditions={'B': 'neg'}, next_node='final_negative'),
            ],
        ),
        'final_positive': Node(node_id='final_positive', final_classification='positive'),
        'final_negative': Node(node_id='final_negative', final_classification='negative'),
    }
    return DiagnosticPathwayEngine(tests, nodes, 'start')


def build_joint_engine():
    joint_d = {
        (("A", "pos"),): 0.90,
        (("A", "neg"),): 0.10,
        (("A", "pos"), ("B", "pos")): 0.88,
        (("A", "pos"), ("B", "neg")): 0.02,
        (("A", "neg"), ("B", "pos")): 0.01,
        (("A", "neg"), ("B", "neg")): 0.09,
    }
    joint_nd = {
        (("A", "pos"),): 0.20,
        (("A", "neg"),): 0.80,
        (("A", "pos"), ("B", "pos")): 0.08,
        (("A", "pos"), ("B", "neg")): 0.12,
        (("A", "neg"), ("B", "pos")): 0.03,
        (("A", "neg"), ("B", "neg")): 0.77,
    }
    tests = {
        'A': DiagnosticTest(name='A', sensitivity=0.90, specificity=0.80, joint_probabilities={'D': joint_d, 'ND': joint_nd}),
        'B': DiagnosticTest(name='B', sensitivity=0.95, specificity=0.90, joint_probabilities={'D': joint_d, 'ND': joint_nd}),
    }
    nodes = {
        'start': Node(
            node_id='start',
            action=Action(test_names=['A', 'B'], parallel_time=True),
            branches=[
                Branch(conditions={'A': 'pos', 'B': 'pos'}, next_node='final_positive'),
                Branch(conditions={'A': 'pos', 'B': 'neg'}, next_node='final_negative'),
                Branch(conditions={'A': 'neg', 'B': 'pos'}, next_node='final_negative'),
                Branch(conditions={'A': 'neg', 'B': 'neg'}, next_node='final_negative'),
            ],
        ),
        'final_positive': Node(node_id='final_positive', final_classification='positive'),
        'final_negative': Node(node_id='final_negative', final_classification='negative'),
    }
    return DiagnosticPathwayEngine(tests, nodes, 'start')


def test_serial_independent_metrics():
    engine = build_independent_engine()
    metrics = engine.aggregate_metrics(prevalence=0.1)
    assert math.isclose(metrics['sensitivity'], 0.90 * 0.95, rel_tol=1e-9)
    assert math.isclose(metrics['specificity'], 1 - ((1 - 0.80) * (1 - 0.90)), rel_tol=1e-9)
    assert metrics['max_skill_required'] == 3
    assert metrics['all_sample_types_required'] == ['blood', 'swab']


def test_joint_probabilities_override_independence():
    engine = build_joint_engine()
    metrics = engine.aggregate_metrics()
    assert math.isclose(metrics['sensitivity'], 0.88, rel_tol=1e-9)
    assert math.isclose(metrics['specificity'], 0.92, rel_tol=1e-9)


def test_validation_harness():
    engine = build_joint_engine()
    metrics = engine.aggregate_metrics()
    validator = ValidationHarness(tolerance=0.02)
    result = validator.validate(metrics, {'sensitivity': 0.88, 'specificity': 0.92})
    assert result['passed'] is True


def test_predictive_values_and_population_metrics():
    engine = build_independent_engine()
    metrics = engine.aggregate_metrics(prevalence=0.1)
    expected_ppv = (0.1 * metrics['sensitivity']) / ((0.1 * metrics['sensitivity']) + (0.9 * (1 - metrics['specificity'])))
    expected_npv = ((0.9 * metrics['specificity'])) / ((0.9 * metrics['specificity']) + (0.1 * (1 - metrics['sensitivity'])))
    assert math.isclose(metrics['ppv'], expected_ppv, rel_tol=1e-9)
    assert math.isclose(metrics['npv'], expected_npv, rel_tol=1e-9)
    assert 'expected_true_positives_per_1000' in metrics
    assert 'expected_false_negatives_per_1000' in metrics


def test_cycle_is_rejected():
    tests = {
        'A': DiagnosticTest(name='A', sensitivity=0.9, specificity=0.8),
    }
    nodes = {
        'start': Node(
            node_id='start',
            action=Action(test_names=['A'], parallel_time=False),
            branches=[Branch(conditions={'A': 'pos'}, next_node='loop')],
        ),
        'loop': Node(
            node_id='loop',
            action=Action(test_names=['A'], parallel_time=False),
            branches=[Branch(conditions={'A': 'pos'}, next_node='start')],
        ),
    }

    with pytest.raises(ValueError, match='cycle'):
        DiagnosticPathwayEngine(tests, nodes, 'start')
