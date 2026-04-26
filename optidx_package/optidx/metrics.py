from __future__ import annotations

from typing import Any, Dict, Iterable


def safe_divide(numerator: float, denominator: float, zero_value: float = 0.0) -> float:
    if denominator <= 0:
        return zero_value
    return numerator / denominator


def enrich_metrics(metrics: Dict[str, Any], prevalence: float) -> Dict[str, Any]:
    enriched = dict(metrics)
    sensitivity = float(enriched.get('sensitivity', 0.0))
    specificity = float(enriched.get('specificity', 0.0))
    expected_cost_population = float(
        enriched.get('expected_cost_population', enriched.get('expected_cost_given_disease', 0.0))
    )
    expected_tat_population = float(
        enriched.get('expected_turnaround_time_population', enriched.get('expected_turnaround_time_given_disease', 0.0))
    )

    probability_algorithm_positive = prevalence * sensitivity + (1.0 - prevalence) * (1.0 - specificity)
    probability_algorithm_negative = prevalence * (1.0 - sensitivity) + (1.0 - prevalence) * specificity
    true_positive_rate = prevalence * sensitivity
    true_negative_rate = (1.0 - prevalence) * specificity

    enriched['prevalence'] = prevalence
    enriched['balanced_accuracy'] = (sensitivity + specificity) / 2.0
    enriched['youden_j'] = sensitivity + specificity - 1.0
    enriched['probability_algorithm_positive'] = probability_algorithm_positive
    enriched['probability_algorithm_negative'] = probability_algorithm_negative
    enriched['true_positive_rate'] = true_positive_rate
    enriched['ppv'] = safe_divide(true_positive_rate, probability_algorithm_positive)
    enriched['npv'] = safe_divide(true_negative_rate, probability_algorithm_negative)
    enriched['cost_per_positive_test'] = safe_divide(expected_cost_population, probability_algorithm_positive, float('inf'))
    enriched['cost_per_true_positive_detected'] = safe_divide(expected_cost_population, true_positive_rate, float('inf'))
    enriched['cost_per_true_positive'] = enriched['cost_per_true_positive_detected']
    enriched['most_cost_effective'] = enriched['cost_per_true_positive_detected']
    enriched['least_cost_per_positive_test'] = enriched['cost_per_positive_test']
    enriched['cost_per_correct_classification'] = safe_divide(
        expected_cost_population,
        true_positive_rate + true_negative_rate,
        float('inf'),
    )
    enriched['max_path_cost'] = max(
        _metric_values(enriched.get('paths_disease_present', []), 'cost')
        + _metric_values(enriched.get('paths_disease_absent', []), 'cost')
        + [0.0]
    )
    enriched['max_path_turnaround_time'] = max(
        _metric_values(enriched.get('paths_disease_present', []), 'turnaround_time')
        + _metric_values(enriched.get('paths_disease_absent', []), 'turnaround_time')
        + [0.0]
    )
    enriched['true_positives_per_1000'] = 1000.0 * true_positive_rate
    enriched['true_negatives_per_1000'] = 1000.0 * true_negative_rate
    enriched['false_positives_per_1000'] = 1000.0 * (1.0 - prevalence) * (1.0 - specificity)
    enriched['false_negatives_per_1000'] = 1000.0 * prevalence * (1.0 - sensitivity)
    enriched['expected_cost_population'] = expected_cost_population
    enriched['expected_turnaround_time_population'] = expected_tat_population
    return enriched


def dominates(left: Dict[str, Any], right: Dict[str, Any]) -> bool:
    left_cost = float(left.get('expected_cost_population', left.get('expected_cost_given_disease', float('inf'))))
    right_cost = float(right.get('expected_cost_population', right.get('expected_cost_given_disease', float('inf'))))
    left_tat = float(left.get('expected_turnaround_time_population', left.get('expected_turnaround_time_given_disease', float('inf'))))
    right_tat = float(right.get('expected_turnaround_time_population', right.get('expected_turnaround_time_given_disease', float('inf'))))
    left_sens = float(left.get('sensitivity', 0.0))
    right_sens = float(right.get('sensitivity', 0.0))
    left_spec = float(left.get('specificity', 0.0))
    right_spec = float(right.get('specificity', 0.0))

    no_worse = left_cost <= right_cost and left_tat <= right_tat and left_sens >= right_sens and left_spec >= right_spec
    strictly_better = left_cost < right_cost or left_tat < right_tat or left_sens > right_sens or left_spec > right_spec
    return no_worse and strictly_better


def partial_state_dominates(left: Dict[str, float], right: Dict[str, float]) -> bool:
    no_worse = (
        left['cost_lower_bound'] <= right['cost_lower_bound']
        and left['tat_lower_bound'] <= right['tat_lower_bound']
        and left['sensitivity_upper_bound'] >= right['sensitivity_upper_bound']
        and left['specificity_upper_bound'] >= right['specificity_upper_bound']
        and left['complexity'] <= right['complexity']
    )
    strictly_better = (
        left['cost_lower_bound'] < right['cost_lower_bound']
        or left['tat_lower_bound'] < right['tat_lower_bound']
        or left['sensitivity_upper_bound'] > right['sensitivity_upper_bound']
        or left['specificity_upper_bound'] > right['specificity_upper_bound']
        or left['complexity'] < right['complexity']
    )
    return no_worse and strictly_better


def _metric_values(paths: Iterable[Dict[str, Any]], key: str) -> list[float]:
    values: list[float] = []
    for path in paths:
        value = path.get(key)
        try:
            values.append(float(value))
        except (TypeError, ValueError):
            continue
    return values
