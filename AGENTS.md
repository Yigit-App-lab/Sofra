# Sofra agent operating rules

This repository, not chat memory, is the source of truth for Sofra.

Before changing code:

1. Read `PROJECT_BRIEF.md`, `TODO.md`, `PROJECT_HISTORY.md`, `TESTING.md`, and
   `HOW_TO_GUIDE_CODEX.md`.
2. Run `npm run preflight` and inspect `git status --short --branch`.
3. Preserve unrelated and untracked user files. Never assume a clean worktree.
4. State the intended outcome and whether it requires JavaScript reload, native rebuild,
   VPS deployment, or database migration.

While working:

- Keep pricing/ranking logic in `src/engine.js`, not in screens.
- Use dry runs and backups before live database changes.
- Never put passwords, private keys, Firebase service-account files, or signing
  credentials in documentation or commits.
- Do not start or cancel EAS builds unless the user explicitly authorizes it. Before
  authorization, state platform, profile, commit, purpose, and whether a rebuild is
  technically necessary.
- Use an iOS development build for active work. Use preview builds only for stable,
  Metro-independent checkpoints. Batch Android builds until Android testing resumes.

Before handing work back:

1. Run the relevant tests and `git diff --check`.
2. Report changed files, verification results, current Git status, rebuild/deployment
   requirements, and exact test steps.
3. Update `TODO.md` when scope/status changes and `PROJECT_HISTORY.md` for material
   decisions, deployments, migrations, audit results, backups, and rollback points.
