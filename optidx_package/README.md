# OptiDx Diagnostic Pathway Engine

This package implements a branching diagnostic-pathway evaluator for complex test combinations with optional dependence-aware probability tables.

## What it does

It computes:
- aggregate sensitivity
- aggregate specificity
- optional expected turnaround time
- optional expected cost
- all sample types required
- maximum skill level required

It supports:
- sequential testing
- parallel testing
- conditional branching
- discordance resolution
- dependence-aware evaluation using joint probabilities

## Core formulas

For terminal leaves classified as positive:

\[
Se_{alg} = \sum_{\ell \in L_+} P(\ell \mid D=1)
\]

For terminal leaves classified as negative:

\[
Sp_{alg} = \sum_{\ell \in L_-} P(\ell \mid D=0)
\]

For dependent paths:

\[
P(path \mid D=d) = \prod_j P(T_j=r_j \mid T_1=r_1, \dots, T_{j-1}=r_{j-1}, D=d)
\]

If the relevant joint tables are not provided, the engine falls back to conditional independence.

## Files

- `optidx/engine.py` . Core engine
- `pathway_schema.json` . JSON schema for pathway definition files
- `benchmarks.json` . Starter benchmark cases extracted from the earlier evidence review
- `tests/test_engine.py` . Unit tests

## Minimal usage

```python
import json
from optidx.engine import DiagnosticPathwayEngine

payload = json.load(open('example_pathway.json'))
engine = DiagnosticPathwayEngine.from_dict(payload)
metrics = engine.aggregate_metrics(prevalence=0.10)
print(metrics['sensitivity'], metrics['specificity'])
```

## Validation workflow

1. Encode a published pathway in JSON.
2. Run the engine.
3. Compare predicted sensitivity and specificity with the observed literature values.
4. If the model differs materially, inspect:
   - pathway logic
   - threshold mismatch
   - wrong dependence assumptions
   - use of step-level rather than pathway-level evidence

## Important methodological note

Many real-world studies report miss rate, avoided downstream testing, or early discharge rather than formal pathway sensitivity and specificity. These cases are still useful, but should be validated using the same endpoint that the original paper reported.
