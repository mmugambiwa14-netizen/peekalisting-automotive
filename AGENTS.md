# PeekaListing Automotive — AI & Repository Operating Contract

This file is authoritative for every AI agent and human contributor working in this repository. Read it before making changes.

## 1. Purpose and source baseline

This repository is the clean, isolated PeekaListing automotive launch experiment.

- Source repository: `mmugambiwa14-netizen/findit-marketplace`
- Imported source branch: `main`
- Immutable source baseline: `fbdffcbacaa83e80871834e6990d0c035cfac314`
- Baseline date: 2026-08-10
- The source repository is reference-only for this project. Never push automotive work back into it unless the owner explicitly asks.

The automotive repository starts as a snapshot, not as a copy of the source repository's branch/commit history.

## 2. Product direction

PeekaListing remains the product and brand. This repository explores a cars-first launch rather than creating a separate car brand.

Initial public scope:

- Cars and other launch-approved road vehicles
- Dealers and verified/private vehicle sellers
- Automotive services that directly support vehicle discovery, verification, acquisition, ownership, maintenance or movement
- Existing Peeks, Peek Requests, business verification, messaging, favourites, notifications, moderation and related platform capabilities where applicable

Property, heavy machinery and unrelated services should be hidden/disabled for the automotive launch rather than destructively removed from reusable platform foundations unless a later explicit decision changes that boundary.

## 3. Repository cleanliness — mandatory

Keep this repository exceptionally clean and easy to understand.

### Branches

- `main` is the single canonical branch.
- Do not create permanent `develop`, `integration`, `certification`, `backup`, `checkpoint`, `preview`, agent-specific or date-stamped branches.
- Create a short-lived branch only when isolation is genuinely needed for a risky or reviewable change.
- If a branch is needed, use a short conventional name such as `feat/dealer-onboarding`, `fix/peek-request`, or `chore/ci`.
- Merge/squash it promptly and delete it after completion.
- Never create branches merely to save progress. Git already preserves committed history.

### Commits

- Prefer one coherent commit for one completed unit of work.
- Squash fixups, retries and agent scratch commits before integration whenever possible.
- Do not create `WIP`, `checkpoint`, `attempt`, `try again`, `backup`, `cert`, `handoff` or meaningless progress commits.
- Do not commit after every small file edit.
- Commit when a logical change is complete, validated and explainable.
- Commit messages must state the durable outcome, not the activity performed.

### Files and documentation

- Do not add generated reports, temporary audits, debug dumps, screenshots, logs, local databases, build output, coverage output, archives or ZIP handoffs to the repository.
- Do not create duplicate documentation for the same topic.
- Prefer updating an existing durable document over creating a new report.
- Keep root-level files minimal.
- Delete temporary scripts/files when their task is complete.
- Do not preserve dead code “just in case”; Git history is the archive.
- Documentation should capture durable architecture, product boundaries, setup or operational decisions only.

## 4. Engineering rules

- Evolve the existing React/Vite + Supabase + PWA architecture; do not rebuild the app or create parallel systems without an explicit architectural reason.
- Reuse existing domain tables, services, hooks, components, notification infrastructure, moderation flows and business systems before adding replacements.
- Inspect the relevant implementation before editing it. Never assume a feature is absent because it is hard to find.
- Preserve existing working behavior unless the automotive product decision explicitly changes it.
- Prefer small, composable, typed changes over large duplicated feature trees.
- Keep shared logic shared. Automotive specialization should be configuration/taxonomy/domain behavior where practical, not copy-pasted platform code.
- Remove unused imports, dead flags and abandoned experiments as part of the same task.
- Keep secrets and credentials out of Git.
- Never point experimental development at production infrastructure without explicit approval.

## 5. Validation rules

Before considering a task complete:

1. Run the relevant typecheck/lint/tests/build already defined by the repository.
2. Add or update focused tests when behavior changes.
3. Verify the actual user flow for high-value changes, not only isolated functions.
4. Do not weaken tests, budgets, RLS/security checks or validation rules merely to make CI green.
5. Report unresolved failures clearly; do not hide or rename them as success.

## 6. AI-agent behavior

Every AI agent must:

- Read this file first.
- Inspect before modifying.
- Work toward the requested product outcome, not produce unnecessary reports.
- Avoid creating branches/commits/files for internal reasoning or checkpoints.
- Prefer finishing a coherent task end-to-end before committing.
- Keep explanations concise and put durable knowledge in code/tests or the smallest appropriate document.
- Never claim work is complete without checking the resulting files and relevant validation.
- Leave the repository cleaner than it was found.

If another AI-specific instruction file conflicts with this one, `AGENTS.md` wins unless the repository owner explicitly says otherwise.

## 7. Source workflows

The original repository's GitHub Actions definitions are preserved under `.github/source-workflows/` as an inactive baseline. They must not be re-enabled wholesale. Bring back only the workflows that this automotive repository actually needs, after checking deployment targets, secrets, branch assumptions and environment names.
