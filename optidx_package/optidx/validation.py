from __future__ import annotations

from hashlib import sha1
import json
from typing import Any, Dict, Iterable, List

from .engine import DiagnosticPathwayEngine


def stable_pathway_id(pathway_json: Dict[str, Any]) -> str:
    canonical = json.dumps(pathway_json, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
    return 'P' + sha1(canonical.encode('utf-8')).hexdigest()[:10]


def validate_candidate_pathway(pathway_json: Dict[str, Any]) -> None:
    DiagnosticPathwayEngine.from_dict(pathway_json)


def validate_branch_exclusivity(pathway_json: Dict[str, Any]) -> None:
    nodes = pathway_json.get('nodes') or {}
    for node_id, node in nodes.items():
        action = node.get('action') if isinstance(node, dict) else None
        if not action:
            continue
        test_names = list(action.get('test_names') or [])
        branches = list(node.get('branches') or [])
        for outcome in _all_outcomes(test_names):
            matches = [
                branch for branch in branches
                if all(outcome.get(test_name) == result for test_name, result in (branch.get('conditions') or {}).items())
            ]
            if len(matches) != 1:
                raise ValueError(f"Node '{node_id}' must have exactly one matching branch for outcome {outcome}; got {len(matches)}")


def validate_acyclic(pathway_json: Dict[str, Any]) -> None:
    nodes = pathway_json.get('nodes') or {}
    start_node = pathway_json.get('start_node')
    visiting: set[str] = set()
    visited: set[str] = set()

    def visit(node_id: str) -> None:
        if node_id in visiting:
            raise ValueError('Cycle detected in pathway graph')
        if node_id in visited:
            return
        visiting.add(node_id)
        for branch in (nodes.get(node_id) or {}).get('branches', []):
            next_node = branch.get('next_node')
            if next_node in nodes:
                visit(str(next_node))
        visiting.remove(node_id)
        visited.add(node_id)

    if start_node in nodes:
        visit(str(start_node))


def _all_outcomes(test_names: List[str]) -> List[Dict[str, str]]:
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
