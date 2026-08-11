# PeekaListing Automotive — Sequential Full-App Agency Mission

Status: ACTIVE OWNER-DIRECTED MISSION

This mission coordinates the project-scoped PeekaListing Codex Agency. `/AGENTS.md` remains authoritative. Work stays isolated to `mmugambiwa14-netizen/peekalisting-automotive`.

## Owner directive

Work through the application comprehensively and sequentially. Start with the frontend. Do not begin the rest of the application until the completed frontend has passed independent validation, has been deployed to a safe Automotive staging preview, and the owner has explicitly approved that preview.

The Frontend Engineer retains the owner-authorized redesign rights defined in `.codex/agents/frontend-engineer.toml`.

## Global execution rules

1. Work sequentially. Do not run implementation workstreams in parallel.
2. Inspect before modifying and reuse existing PeekaListing systems.
3. One specialist owns a step at a time and hands off evidence to the next specialist.
4. Do not let an implementer certify its own work.
5. Do not continue past a failed gate. Repair the current phase, re-run its independent validation, then advance.
6. Preserve Cars-first scope. Keep Property, heavy machinery, unrelated services, and unaccepted full Tours/Response Peek capabilities hidden or fail-closed unless the owner changes scope.
7. Never weaken RLS, authorization, privacy, release interlocks, tests, or validation to make a phase pass.
8. Keep staging test data rollback-safe/disposable and leave hosted staging clean.
9. Prefer one coherent commit per completed phase or genuinely indivisible completed unit; no WIP/checkpoint commits.
10. Every completion claim must distinguish source validation, hosted validation, and anything still unverified.

# PHASE 1 — FRONTEND FIRST

No later phase may begin before the Owner Preview Gate is explicitly released by the owner.

## Step 1.1 — Codebase Onboarding Engineer: complete frontend inventory

Read-only. Build a factual map of every active Cars-first frontend surface, route, component, service dependency, feature flag, and state. At minimum inspect active flows for:

- public landing/home and navigation;
- Cars discovery/search/filter/results;
- listing cards and listing detail;
- dealer directory and dealer profiles;
- authentication/onboarding/account recovery surfaces;
- private seller and dealer listing submission/edit/manage flows;
- business/dealer application and verification flows;
- favourites/saved items;
- messaging/inquiries/chats;
- notification center and PWA notification surfaces;
- profile/account/settings/account deletion surfaces;
- reports/safety/moderation-facing user flows;
- Peek/Peek Request surfaces in their current Automotive release state;
- responsive/mobile/PWA navigation and install/offline states;
- admin/operations frontend surfaces required to operate the active Cars-first launch.

Do not assume a surface is absent until traced.

## Step 1.2 — Product Manager: frontend product contract

Using the inventory and current Cars-first product boundary, define the active information architecture, user journeys, acceptance criteria, non-goals, and trust/safety requirements for the frontend. Resolve duplicated or contradictory UI behavior before implementation. Do not resurrect hidden categories or gated capabilities.

## Step 1.3 — Frontend Engineer: comprehensive frontend redesign and implementation

This is not a minimal-diff assignment. The Frontend Engineer may comprehensively redesign weak or inconsistent active frontend surfaces and the shared presentation system when justified by the requested outcome.

The result must feel like one coherent PeekaListing Automotive product, not a collection of inherited marketplace screens. The engineer may change information architecture, page composition, layout, navigation within Cars-first scope, visual hierarchy, responsive patterns, components, styling, interactions, loading/empty/error states, and reusable frontend primitives.

Requirements:

- preserve correct backend/data/security contracts;
- mobile-first with excellent tablet and desktop behavior;
- accessible keyboard/focus/semantic behavior and readable contrast;
- consistent Cars-first terminology and state language;
- explicit loading, empty, error, permission, unavailable, and offline states;
- no dead CTAs to disabled capabilities;
- no hidden category leakage;
- no raw private contact exposure;
- no presentation-only authorization assumptions;
- reuse working services/hooks/domain logic instead of creating parallel frontend data systems;
- maintain reasonable bundle/runtime performance;
- update focused tests for changed behavior.

The frontend phase covers all active user-facing and operational frontend surfaces necessary for the Cars-first staging product, not only the homepage.

## Step 1.4 — Test Automation Engineer: independent frontend verification

Independently verify the implemented frontend using the repository's existing test/build tools and real user journeys. Cover representative mobile, tablet, and desktop behavior where tooling permits. Validate interaction states, routes, forms, navigation, accessibility basics, feature gates, errors, and regression-sensitive flows. Report environment/tooling blockers separately from product failures.

## Step 1.5 — Reality Checker: frontend certification

Review the implementation and independent QA evidence. Default to NEEDS WORK. The frontend may advance only when the active Cars-first frontend is coherent, functional, responsive, and supported by evidence. A passing source build alone is insufficient if critical user journeys are broken.

If NEEDS WORK, return to Step 1.3, then repeat Steps 1.4 and 1.5.

## Step 1.6 — DevOps Release Engineer: preview deployment only

After frontend certification, deploy the exact certified frontend commit to the isolated Automotive staging preview using the existing safe release boundary. Do not bypass protected/manual release controls or point to inherited FindIt infrastructure. Verify the exact build identity and hosted target.

Primary preview target: `https://cars-staging.peekalisting.com`.

If staging deployment is blocked by GitHub environment, billing, runner, Cloudflare, credentials, or another infrastructure restriction, STOP and surface that blocker. Do not continue to Phase 2 merely because source validation passed.

# OWNER PREVIEW GATE — HARD STOP

After a verified frontend preview is available:

1. Present the owner with the preview URL and the exact commit/build identity.
2. Summarize only the most important frontend changes and known limitations.
3. Ask for owner approval or requested frontend changes.
4. DO NOT START PHASE 2 OR ANY LATER PHASE UNTIL THE OWNER EXPLICITLY APPROVES THE FRONTEND PREVIEW.

Silence, timeout, implied approval, a green build, or agent consensus does not release this gate.

If the owner requests changes, return to Frontend Engineer -> Test Automation -> Reality Checker -> preview deployment, then present the updated preview again.

# PHASE 2 — BACKEND AND DOMAIN WORKFLOWS

Starts only after explicit owner frontend-preview approval.

Sequential order:

1. Codebase Onboarding Engineer maps active backend/domain paths and existing primitives.
2. Backend Architect audits and repairs active Cars-first domain workflows without creating parallel systems.
3. Minimal Change Engineer handles bounded defects identified by the audit where a surgical fix is safer than architectural work.
4. API Tester independently verifies allowed/denied callers, error semantics, side effects, and audit behavior.
5. Reality Checker gates the phase.

Scope includes active listing lifecycle, dealer/business workflows, messaging/inquiries, favourites, notifications, reporting/moderation domain behavior, contact reveals, account lifecycle, and current Peek release-state behavior.

# PHASE 3 — DATABASE AND DATA BOUNDARIES

Sequential order:

1. Database Engineer audits migrations, schema, RLS, grants/default ACLs, ownership, functions, indexes, storage policies, realtime publication, and data lifecycle for active Cars-first functionality.
2. Backend Architect reviews database/application contract consistency.
3. API Tester executes rollback-safe hosted authorization/data-boundary smoke tests where access permits.
4. Reality Checker gates the phase.

No raw DDL outside durable migrations for repository changes. Do not leave staging fixtures behind.

# PHASE 4 — IDENTITY, APPLICATION SECURITY, AND PRIVACY

Sequential order:

1. Identity & Access Engineer audits auth/session/OAuth/owner/admin/account-lifecycle boundaries.
2. Security Architect threat-models active trust boundaries and high-impact flows.
3. Application Security Engineer reviews implementation-level vulnerabilities and adds/requests durable regression coverage.
4. Privacy Engineer audits public/private data exposure, contact reveal, seller/dealer profiles, media metadata, deletion/export/retention behavior.
5. Test Automation/API Tester validates fixes and negative cases.
6. Reality Checker gates the phase.

Do not claim hosted Auth settings are correct if they cannot be inspected.

# PHASE 5 — PLATFORM INTEGRATIONS AND ACTIVE RUNTIME CAPABILITIES

Sequential order:

1. Backend Architect maps and validates active Edge Functions, storage, realtime, notification, messaging, upload/media, and PWA integration paths.
2. Identity & Access Engineer checks auth boundaries for those integrations.
3. Application Security Engineer reviews browser/server trust and abuse paths.
4. API Tester validates hosted boundaries where possible.
5. Reality Checker gates the phase.

Keep full Tours/Response Peek fail-closed until its separate runtime and acceptance prerequisites are genuinely complete.

# PHASE 6 — PERFORMANCE AND RELIABILITY

Sequential order:

1. Performance Benchmarker establishes evidence-based frontend, query/API, media, and realistic concurrency baselines and fixes material regressions with the appropriate implementer.
2. SRE audits observability, dependency failure behavior, graceful degradation, capacity assumptions, recovery, and operational readiness.
3. Test Automation Engineer verifies performance/reliability-sensitive regressions that can be automated.
4. Reality Checker gates the phase.

Never equate architectural intent with proven scale readiness.

# PHASE 7 — FULL END-TO-END QUALITY AND HARDENING

Sequential order:

1. Test Automation Engineer runs the broadest relevant repository test/typecheck/lint/build and end-to-end journey suite available.
2. API Tester validates critical hosted API journeys and denied cases where possible.
3. Application Security Engineer performs a final code/security regression review of changed high-risk paths.
4. Reality Checker performs cross-system certification and returns PASS, NEEDS WORK, or BLOCKED with evidence.

Repair any failure in the owning earlier phase, then repeat the affected independent gates.

# PHASE 8 — RELEASE READINESS

Sequential order:

1. DevOps Release Engineer verifies CI/CD, environment isolation, exact build identity, Cloudflare/Supabase target boundaries, required Edge Functions, and release gates.
2. SRE verifies operational monitoring/recovery expectations appropriate to the launch stage.
3. Reality Checker verifies that staging claims match the actually hosted build and that no blocker is being relabeled as success.

Do not promote to production or attach the production domain without explicit owner approval.

# PHASE 9 — PRODUCT AND DEALER LAUNCH READINESS

Sequential order:

1. Product Manager checks Cars-first scope coherence, launch journeys, known limitations, and measurable acceptance outcomes.
2. Dealer Growth Strategist prepares evidence-grounded dealer onboarding/outreach positioning based only on capabilities that actually passed staging.
3. Reality Checker verifies that product/sales claims do not overstate disabled or unverified functionality.

This phase produces readiness guidance; external commercial commitments remain owner decisions.

# FINAL COMPLETION GATE

The full mission is COMPLETE only when every owner-released phase has passed its independent gate and the final hosted/release claims are evidenced. Otherwise the mission remains NEEDS WORK or BLOCKED.
