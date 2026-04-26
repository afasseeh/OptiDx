from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Optional


@dataclass(frozen=True)
class OptimizationConstraints:
    prevalence: float
    min_sensitivity: float = 0.0
    min_specificity: float = 0.0
    max_cost_per_patient_usd: Optional[float] = None
    max_turnaround_time_hours: Optional[float] = None
    lab_technician_allowed: bool = True
    radiologist_allowed: bool = True
    specialist_physician_allowed: bool = True
    primary_care: bool = False
    hospital: bool = False
    community: bool = False
    mobile_unit: bool = False
    none_allowed: bool = True
    blood_allowed: bool = True
    urine_allowed: bool = True
    stool_allowed: bool = True
    sputum_allowed: bool = True
    nasal_swab_allowed: bool = True
    imaging_allowed: bool = True


@dataclass(frozen=True)
class OptimizerConfig:
    max_stages: int = 4
    max_tests_per_realized_path: int = 6
    max_parallel_block_size: int = 3
    max_candidates: int = 5000
    time_limit_seconds: int = 900
    allow_repeated_test: bool = True
    allow_same_test_in_different_branches: bool = True


@dataclass(frozen=True)
class DiagnosticTool:
    id: str
    name: str
    sensitivity: float
    specificity: float
    turnaround_time: float = 0.0
    turnaround_time_unit: str = 'hr'
    sample_types: list[str] = field(default_factory=list)
    skill_level: int = 0
    cost: float = 0.0
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
    joint_probabilities: Dict[str, Dict[str, Dict[tuple, float]]] = field(default_factory=dict)


@dataclass
class SearchLeaf:
    node_id: str
    disease_mass: float
    no_disease_mass: float
    stage_count: int
    tests_used_on_path: tuple[str, ...] = field(default_factory=tuple)
    current_path_cost: float = 0.0
    current_path_tat: float = 0.0


@dataclass
class SearchState:
    start_node: str
    tests: Dict[str, Dict[str, Any]]
    partial_pathway_graph: Dict[str, Any]
    unresolved_leaves: list[SearchLeaf]
    depth_or_stage_count: int
    tests_used_on_each_realized_path: list[tuple[str, ...]] = field(default_factory=list)
    test_invocations: Dict[str, int] = field(default_factory=dict)
    current_sample_types: tuple[str, ...] = field(default_factory=tuple)
    current_required_skill_roles: tuple[str, ...] = field(default_factory=tuple)
    current_expected_cost_lower_bound: float = 0.0
    current_expected_tat_lower_bound: float = 0.0
    current_max_path_cost: float = 0.0
    current_max_path_tat: float = 0.0
    resolved_positive_mass_disease: float = 0.0
    resolved_negative_mass_disease: float = 0.0
    unresolved_mass_disease: float = 1.0
    resolved_positive_mass_no_disease: float = 0.0
    resolved_negative_mass_no_disease: float = 0.0
    unresolved_mass_no_disease: float = 1.0
    sensitivity_upper_bound: float = 1.0
    specificity_upper_bound: float = 1.0
    canonical_signature: str = ''
    search_trace: Dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class CandidatePathway:
    pathway_id: str
    objective_name: Optional[str]
    pathway_json: Dict[str, Any]
    human_readable_pathway_description: str
    metrics: Dict[str, Any]
    required_skill_roles: list[str]
    sample_types: list[str]
    setting_metadata: Dict[str, bool]
    pathway_complexity: int
    optimizer_metadata: Dict[str, Any]
    warnings: list[str] = field(default_factory=list)


@dataclass
class ParetoFrontier:
    candidates: list[CandidatePathway] = field(default_factory=list)


@dataclass(frozen=True)
class OptimizationResult:
    status: str
    search_exhaustive: bool
    inputs: Dict[str, Any]
    constraints: Dict[str, Any]
    prevalence: float
    selected_outputs: Dict[str, Any]
    pareto_frontier: list[Dict[str, Any]] = field(default_factory=list)
    pareto_frontier_ids: list[str] = field(default_factory=list)
    feasible_candidate_count: int = 0
    warnings: list[str] = field(default_factory=list)
    rejection_summary: Optional[Dict[str, int]] = None
    best_observed_near_misses: Optional[Dict[str, Any]] = None
    candidate_count: int = 0
    run_ms: int = 0
    assumptions: Dict[str, Any] = field(default_factory=dict)
    search_summary: Dict[str, Any] = field(default_factory=dict)
    message: Optional[str] = None
