from __future__ import annotations

from typing import Any, Dict

from .validation import stable_pathway_id


def build_pathway_metadata(label: str, base_tool_map: Dict[str, str]) -> Dict[str, Any]:
    return {
        'label': label,
        'template_summary': label.lower().replace(' ', '_'),
        'base_tool_map': dict(base_tool_map),
    }


def compile_pathway_id(pathway_json: Dict[str, Any]) -> str:
    return stable_pathway_id(pathway_json)
