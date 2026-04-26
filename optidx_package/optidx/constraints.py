from __future__ import annotations

from typing import Any, Dict, Iterable, Mapping

from .models import DiagnosticTool, OptimizationConstraints, OptimizerConfig


SAMPLE_FLAG_ALIASES = {
    'none': {'none', 'no sample', 'not applicable', ''},
    'blood': {'blood', 'serum', 'plasma', 'fingerstick'},
    'urine': {'urine'},
    'stool': {'stool', 'feces', 'faeces'},
    'sputum': {'sputum'},
    'nasal_swab': {'nasal swab', 'nasopharyngeal swab', 'swab'},
    'imaging': {'imaging', 'x-ray', 'xray', 'ct', 'mri', 'ultrasound', 'radiograph'},
}


def normalize_project_constraints(raw: Mapping[str, Any] | None) -> OptimizationConstraints:
    data = dict(raw or {})
    prevalence_value = data.get('prevalence')
    if prevalence_value in (None, ''):
        raise ValueError('Prevalence is required for optimization.')

    prevalence = float(prevalence_value)
    return OptimizationConstraints(
        prevalence=prevalence,
        min_sensitivity=float(data.get('min_sensitivity', data.get('minimum_sensitivity', 0.0)) or 0.0),
        min_specificity=float(data.get('min_specificity', data.get('minimum_specificity', 0.0)) or 0.0),
        max_cost_per_patient_usd=_number_or_none(data.get('max_cost_per_patient_usd', data.get('maximum_total_cost', data.get('max_expected_cost')))),
        max_turnaround_time_hours=_number_or_none(data.get('max_turnaround_time_hours', data.get('maximum_turnaround_time', data.get('max_expected_tat')))),
        lab_technician_allowed=bool(data.get('lab_technician_allowed', data.get('allow_lab_technician', True))),
        radiologist_allowed=bool(data.get('radiologist_allowed', data.get('allow_radiologist', True))),
        specialist_physician_allowed=bool(data.get('specialist_physician_allowed', data.get('allow_specialist_physician', True))),
        primary_care=bool(data.get('primary_care', data.get('setting_primary_care', False))),
        hospital=bool(data.get('hospital', data.get('setting_hospital', False))),
        community=bool(data.get('community', data.get('setting_community', False))),
        mobile_unit=bool(data.get('mobile_unit', data.get('setting_mobile_unit', False))),
        none_allowed=bool(data.get('none_allowed', data.get('allow_sample_none', True))),
        blood_allowed=bool(data.get('blood_allowed', data.get('allow_sample_blood', True))),
        urine_allowed=bool(data.get('urine_allowed', data.get('allow_sample_urine', True))),
        stool_allowed=bool(data.get('stool_allowed', data.get('allow_sample_stool', True))),
        sputum_allowed=bool(data.get('sputum_allowed', data.get('allow_sample_sputum', True))),
        nasal_swab_allowed=bool(data.get('nasal_swab_allowed', data.get('allow_sample_nasal_swab', True))),
        imaging_allowed=bool(data.get('imaging_allowed', data.get('allow_sample_imaging', True))),
    )


def normalize_search_config(raw: Mapping[str, Any] | None) -> OptimizerConfig:
    data = dict(raw or {})
    return OptimizerConfig(
        max_stages=max(1, int(data.get('max_stages', 4) or 4)),
        max_tests_per_realized_path=max(1, int(data.get('max_tests_per_realized_path', data.get('max_invocations_per_path', 6)) or 6)),
        max_parallel_block_size=max(1, int(data.get('max_parallel_block_size', 3) or 3)),
        max_candidates=max(1, int(data.get('max_candidates', 5000) or 5000)),
        time_limit_seconds=max(1, int(data.get('time_limit_seconds', 900) or 900)),
        allow_repeated_test=bool(data.get('allow_repeated_test', True)),
        allow_same_test_in_different_branches=bool(data.get('allow_same_test_in_different_branches', True)),
    )


def normalize_tool(test_id: str, raw: Mapping[str, Any]) -> DiagnosticTool:
    sample_types = _normalize_sample_types(raw)
    sample_flags = _derive_sample_flags(sample_types, raw)
    role_flags = _derive_role_flags(raw)
    return DiagnosticTool(
        id=str(test_id),
        name=str(raw.get('name') or raw.get('label') or test_id),
        sensitivity=float(raw.get('sensitivity', raw.get('sens', 0.0)) or 0.0),
        specificity=float(raw.get('specificity', raw.get('spec', 0.0)) or 0.0),
        turnaround_time=_number_or_zero(raw.get('turnaround_time', raw.get('tat', 0.0))),
        turnaround_time_unit=str(raw.get('turnaround_time_unit', raw.get('tatUnit', 'hr')) or 'hr'),
        sample_types=sample_types,
        skill_level=_skill_level(raw.get('skill_level', raw.get('skill', 0))),
        cost=_number_or_zero(raw.get('cost', 0.0)),
        requires_lab_technician=role_flags['lab_technician'],
        requires_radiologist=role_flags['radiologist'],
        requires_specialist_physician=role_flags['specialist_physician'],
        sample_none=sample_flags['none'],
        sample_blood=sample_flags['blood'],
        sample_urine=sample_flags['urine'],
        sample_stool=sample_flags['stool'],
        sample_sputum=sample_flags['sputum'],
        sample_nasal_swab=sample_flags['nasal_swab'],
        sample_imaging=sample_flags['imaging'],
        base_test_id=str(raw.get('base_test_id') or test_id),
        invocation_id=str(raw.get('invocation_id') or test_id),
        is_repeat_invocation=bool(raw.get('is_repeat_invocation', False)),
        joint_probabilities=dict(raw.get('joint_probabilities') or {}),
    )


def normalize_tests(raw_tests: Mapping[str, Any] | list[Any]) -> Dict[str, DiagnosticTool]:
    normalized: Dict[str, DiagnosticTool] = {}
    if isinstance(raw_tests, list):
        iterable = []
        for item in raw_tests:
            if isinstance(item, Mapping) and (item.get('id') or item.get('name')):
                iterable.append((str(item.get('id') or item.get('name')), item))
    else:
        iterable = [(str(test_id), raw) for test_id, raw in dict(raw_tests or {}).items() if isinstance(raw, Mapping)]

    for test_id, raw in iterable:
        normalized[test_id] = normalize_tool(test_id, raw)
    return normalized


def tool_allowed(tool: DiagnosticTool, constraints: OptimizationConstraints) -> bool:
    roles = {
        'lab_technician': tool.requires_lab_technician,
        'radiologist': tool.requires_radiologist,
        'specialist_physician': tool.requires_specialist_physician,
    }
    if roles['lab_technician'] and not constraints.lab_technician_allowed:
        return False
    if roles['radiologist'] and not constraints.radiologist_allowed:
        return False
    if roles['specialist_physician'] and not constraints.specialist_physician_allowed:
        return False

    sample_flags = tool_sample_flags(tool)
    if sample_flags['none'] and not constraints.none_allowed:
        return False
    if sample_flags['blood'] and not constraints.blood_allowed:
        return False
    if sample_flags['urine'] and not constraints.urine_allowed:
        return False
    if sample_flags['stool'] and not constraints.stool_allowed:
        return False
    if sample_flags['sputum'] and not constraints.sputum_allowed:
        return False
    if sample_flags['nasal_swab'] and not constraints.nasal_swab_allowed:
        return False
    if sample_flags['imaging'] and not constraints.imaging_allowed:
        return False
    return True


def tool_sample_flags(tool: DiagnosticTool) -> Dict[str, bool]:
    flattened = _flatten_samples(tool.sample_types)
    return {
        'none': tool.sample_none or not tool.sample_types,
        'blood': tool.sample_blood or any(sample in flattened for sample in SAMPLE_FLAG_ALIASES['blood']),
        'urine': tool.sample_urine or any(sample in flattened for sample in SAMPLE_FLAG_ALIASES['urine']),
        'stool': tool.sample_stool or any(sample in flattened for sample in SAMPLE_FLAG_ALIASES['stool']),
        'sputum': tool.sample_sputum or any(sample in flattened for sample in SAMPLE_FLAG_ALIASES['sputum']),
        'nasal_swab': tool.sample_nasal_swab or any(sample in flattened for sample in SAMPLE_FLAG_ALIASES['nasal_swab']),
        'imaging': tool.sample_imaging or any(sample in flattened for sample in SAMPLE_FLAG_ALIASES['imaging']),
    }


def tool_required_roles(tool: DiagnosticTool) -> list[str]:
    roles: list[str] = []
    if tool.requires_lab_technician:
        roles.append('lab_technician')
    if tool.requires_radiologist:
        roles.append('radiologist')
    if tool.requires_specialist_physician:
        roles.append('specialist_physician')
    return roles


def tool_complexity_cost(tool: DiagnosticTool) -> int:
    return 1


def _flatten_samples(sample_types: Iterable[str]) -> set[str]:
    return {str(sample).strip().lower() for sample in sample_types if str(sample).strip()}


def _derive_sample_flags(sample_types: list[str], raw: Mapping[str, Any]) -> Dict[str, bool]:
    normalized = _flatten_samples(sample_types)
    return {
        'none': bool(raw.get('sample_none', False)) or normalized == set() or any(sample in normalized for sample in SAMPLE_FLAG_ALIASES['none']),
        'blood': bool(raw.get('sample_blood', False)) or any(sample in normalized for sample in SAMPLE_FLAG_ALIASES['blood']),
        'urine': bool(raw.get('sample_urine', False)) or any(sample in normalized for sample in SAMPLE_FLAG_ALIASES['urine']),
        'stool': bool(raw.get('sample_stool', False)) or any(sample in normalized for sample in SAMPLE_FLAG_ALIASES['stool']),
        'sputum': bool(raw.get('sample_sputum', False)) or any(sample in normalized for sample in SAMPLE_FLAG_ALIASES['sputum']),
        'nasal_swab': bool(raw.get('sample_nasal_swab', False)) or any(sample in normalized for sample in SAMPLE_FLAG_ALIASES['nasal_swab']),
        'imaging': bool(raw.get('sample_imaging', False)) or any(sample in normalized for sample in SAMPLE_FLAG_ALIASES['imaging']),
    }


def _derive_role_flags(raw: Mapping[str, Any]) -> Dict[str, bool]:
    if any(key in raw for key in ('requires_lab_technician', 'requires_radiologist', 'requires_specialist_physician')):
        return {
            'lab_technician': bool(raw.get('requires_lab_technician', False)),
            'radiologist': bool(raw.get('requires_radiologist', False)),
            'specialist_physician': bool(raw.get('requires_specialist_physician', False)),
        }

    skill_level = _skill_level(raw.get('skill_level', raw.get('skill', 0)))
    if skill_level <= 0:
        return {'lab_technician': False, 'radiologist': False, 'specialist_physician': False}
    if skill_level <= 2:
        return {'lab_technician': True, 'radiologist': False, 'specialist_physician': False}
    if skill_level == 3:
        return {'lab_technician': True, 'radiologist': False, 'specialist_physician': False}
    if skill_level == 4:
        role_source = str(raw.get('skill') or raw.get('skill_label') or '').lower()
        if 'radiolog' in role_source:
            return {'lab_technician': False, 'radiologist': True, 'specialist_physician': False}
        return {'lab_technician': False, 'radiologist': False, 'specialist_physician': True}
    return {'lab_technician': False, 'radiologist': False, 'specialist_physician': True}


def _normalize_sample_types(raw: Mapping[str, Any]) -> list[str]:
    sample_types = raw.get('sample_types', None)
    if isinstance(sample_types, str):
        sample_types = [sample_types]
    if not isinstance(sample_types, list):
        sample_types = [raw.get('sample')] if raw.get('sample') else []
    return [str(sample).strip() for sample in sample_types if str(sample).strip()]


def _skill_level(value: Any) -> int:
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.strip().isdigit():
        return int(value.strip())
    source = str(value or '').lower()
    if 'chw' in source or 'self' in source:
        return 1
    if 'nurse' in source:
        return 2
    if 'radiographer' in source or 'lab tech' in source or 'lab technician' in source:
        return 3
    if 'radiologist' in source or 'specialist' in source or 'bsl-2' in source:
        return 4
    if 'bsl-3' in source:
        return 5
    return 0


def _number_or_zero(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _number_or_none(value: Any) -> float | None:
    try:
        return None if value is None or value == '' else float(value)
    except (TypeError, ValueError):
        return None
