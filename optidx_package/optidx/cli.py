from __future__ import annotations

import argparse
import json
import sys

from .engine import DiagnosticPathwayEngine, ValidationHarness


def _load_payload() -> dict:
    return json.loads(sys.stdin.read() or '{}')


def main() -> int:
    try:
        parser = argparse.ArgumentParser(prog='optidx-cli')
        parser.add_argument('action', choices=['validate', 'evaluate', 'benchmark', 'optimize'])
        args = parser.parse_args()

        payload = _load_payload()

        if args.action == 'optimize':
            templates = payload.get('templates') or []
            ranked_results = []

            for template in templates:
                if not isinstance(template, dict):
                    continue

                label = (template.get('metadata') or {}).get('label') or 'Candidate pathway'

                try:
                    candidate_engine = DiagnosticPathwayEngine.from_dict(template)
                    candidate_metrics = candidate_engine.aggregate_metrics(payload.get('prevalence'))
                    ranked_results.append({
                        'pathway': template,
                        'metrics': candidate_metrics,
                        'warnings': candidate_metrics.get('warnings', []),
                        'label': label,
                    })
                except Exception as exc:  # pragma: no cover - surfaced to Laravel bridge
                    ranked_results.append({
                        'pathway': template,
                        'metrics': {},
                        'warnings': [str(exc)],
                        'label': label,
                    })

            print(json.dumps({
                'validation': {'valid': True, 'errors': [], 'warnings': []},
                'ranked_results': ranked_results,
                'engine_version': 'python-canonical',
            }))
            return 0

        try:
            engine = DiagnosticPathwayEngine.from_dict(payload)
        except Exception as exc:  # pragma: no cover - surfaced to Laravel bridge
            result = {
                'validation': {'valid': False, 'errors': [str(exc)], 'warnings': []},
                'metrics': {},
                'engine_version': 'python-canonical',
            }
            print(json.dumps(result))
            return 1

        if args.action == 'validate':
            result = {
                'validation': {'valid': True, 'errors': [], 'warnings': []},
                'metrics': engine.aggregate_metrics(payload.get('prevalence')),
                'engine_version': 'python-canonical',
            }
            print(json.dumps(result))
            return 0

        metrics = engine.aggregate_metrics(payload.get('prevalence'))
        output = {
            'validation': {'valid': True, 'errors': [], 'warnings': metrics.get('warnings', [])},
            'metrics': metrics,
            'paths': {
                'disease_present': metrics.get('paths_disease_present', []),
                'disease_absent': metrics.get('paths_disease_absent', []),
            },
            'engine_version': 'python-canonical',
        }

        if args.action == 'benchmark':
            validator = ValidationHarness(tolerance=0.02)
            expected = payload.get('expected_metrics') or {}
            output['benchmark'] = validator.validate(metrics, expected)

        print(json.dumps(output))
        return 0
    except Exception as exc:  # pragma: no cover - surfaced to Laravel bridge
        result = {
            'validation': {'valid': False, 'errors': [str(exc)], 'warnings': []},
            'metrics': {},
            'engine_version': 'python-canonical',
        }
        print(json.dumps(result))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
