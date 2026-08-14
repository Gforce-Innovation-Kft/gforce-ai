# Agent scorecards

One `<agent-name>.scorecard.json` per agent, written from the output of
`evals/run-suite.ts`. CI (`scripts/check-scorecard.sh`) verifies that a PR
changing an agent carries a scorecard whose `content_sha256` matches the
agent file — it never runs the evals itself: burning eval tokens is always an
explicit human decision (local run or `workflow_dispatch`).

Format:

```json
{
  "agent": "gforce-sf-code-reviewer",
  "content_sha256": "<sha256 of the agents/<name>.md bytes the suite ran against>",
  "recall": { "hits": 3, "total": 3 },
  "false_positives": 0,
  "clean_total": 1,
  "run_at": "2026-08-14",
  "cost_cents": 42
}
```

Both metrics are required because recall alone is gameable — an agent that
flags everything scores 100% recall. An agent failing its suite twice is
deleted, not patched (`standards/agent-standard.md`).
