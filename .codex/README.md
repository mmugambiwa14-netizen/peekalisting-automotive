# PeekaListing Automotive Codex Agency

This directory contains the project-scoped Codex specialist roster for the isolated PeekaListing Automotive repository.

`/AGENTS.md` is authoritative over every specialist. The roster is intentionally curated rather than installing the full upstream Agency catalog.

## Command structure

`PeekaListing Orchestrator` is the coordinator. It should activate the smallest useful team, keep a task ledger, require structured handoffs, and prevent builders from certifying their own work.

The 18 specialists cover repository discovery, narrow fixes, frontend, backend, database, architecture, release engineering, reliability, identity/access, application security, security architecture, privacy, automated testing, API testing, performance, release certification, product, and dealer growth.

## Frontend redesign authority

The `PeekaListing Frontend Engineer` has explicit owner authorization to redesign the relevant UI/UX surface on frontend-facing missions. This is a deliberate exception to the `Minimal Change Engineer` default. The frontend role may materially change layout, information architecture, component composition, responsive behavior, interaction patterns, styling, visual hierarchy, and reusable presentation systems when that better satisfies the requested frontend outcome.

That authority does not permit weakening backend/security contracts, exposing gated features, or changing Cars-first product scope without justification and the appropriate specialist review.

## Suggested activation

- Narrow bug: Codebase Onboarding + relevant implementer + Test Automation + Reality Checker.
- UI/frontend: Codebase Onboarding + Frontend Engineer + Test Automation + Reality Checker; Product Manager when product behavior changes.
- Auth/data: Identity & Access + Database/Backend + AppSec + API Tester.
- Release: DevOps Release + SRE + AppSec/API Tester + Reality Checker.
- Major feature: Product Manager + Software Architect + implementation specialists + security/performance/QA.
- Dealer acquisition: Product Manager + Dealer Growth Strategist.

## Upstream inspiration

This roster is adapted from concepts and role patterns in `msitarzewski/agency-agents` (The Agency), used under its MIT license. The upstream license text is preserved in `.codex/AGENCY_UPSTREAM_LICENSE.md`. The PeekaListing versions are intentionally rewritten for this repository's React/Vite + Supabase + PWA architecture and its operating contract rather than copied wholesale.
