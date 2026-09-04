# How to guide Codex on Sofra

You do not need to write technical specifications. A short request becomes much more
reliable when it includes the following information.

## Best request format

```text
Goal: What should become better for the user?
Current behavior: What happens now?
Expected behavior: What should happen instead?
Where: Which tab, screen, button, recipe, or account state?
Acceptance check: What should I demonstrate before calling it complete?
Constraints: Anything that must not change?
Release instruction: Local change only, push to Git, deploy VPS, or request a build?
Evidence: Screenshot, error text, recipe ID, terminal output, or sample account state.
```

Example:

```text
Goal: Make onboarding explain dietary filters.
Current behavior: Three pages; filters are not mentioned.
Expected behavior: Add a page explaining that all three suggestion methods use the filters.
Where: First-run onboarding, before the pantry page.
Acceptance check: Four swipeable pages on the installed iOS development build.
Constraints: Keep Turkish as default and reuse the existing theme.
Release instruction: Implement and test locally; do not create an EAS build yet.
```

## For a bug report

Please provide, when available:

- the exact screen and action immediately before the problem;
- a screenshot containing the complete first error message;
- the latest Metro or server lines;
- whether the installed app is development or preview;
- whether the issue reproduces after one normal reload;
- a recipe ID/account state when data-specific.

Avoid paraphrasing an error if it can be copied. The first line normally matters more
than a long call stack.

## For product decisions

Tell me the user rule, not only the visual change. For example: “A user may like and
cook the same recipe; only liking changes taste.” This lets me update UI, storage,
sync, tests, and documentation consistently.

If several interpretations are acceptable, say “use your judgment.” If a choice has
business, privacy, cost, or irreversible data consequences, expect me to stop and
present the trade-off before acting.

## For recipe and cost corrections

Include recipe ID, title, stated servings, full ingredient text, displayed cost, and
what looks implausible. Specify whether the correction is certain or expert judgment.
Live database changes follow dry-run → backup → apply → audit → service health check.

## How you can inspect the project

- Open `TODO.md` for pending work.
- Open `PROJECT_BRIEF.md` for product rules and architecture.
- Open `PROJECT_HISTORY.md` for completed work, deployments, backups, and audit results.
- Open `TESTING.md` for commands and build troubleshooting.
- Run `npm.cmd run preflight` for configuration and Git-state checks.
- Run `git diff` to see uncommitted code changes.
- Run `git log -5 --oneline` to see recent saved checkpoints.

When any document is wrong, tell me the corrected rule explicitly. I should update the
document and code together so the correction survives future conversations.

## Recommended work rhythm

1. Select one item from `TODO.md` and define its acceptance check.
2. I inspect relevant code/data and state whether a rebuild or deployment is needed.
3. I implement and run automated checks.
4. You test the exact user path on the development build.
5. We fix observed issues, then commit/push only when the checkpoint is stable.
6. I update the backlog/history and state the next recommended item.

