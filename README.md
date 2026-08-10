# PeekaListing Automotive

PeekaListing is a trusted automotive marketplace focused on helping people discover vehicles, evaluate them with better information, connect with sellers, and access relevant automotive services around the purchase and ownership journey.

This repository is the automotive-first PeekaListing product intended for the initial launch phase.

## Product scope

The public product is being focused around automotive discovery and trust.

Core surfaces include:

- Vehicle listings
- Dealerships and private vehicle sellers
- Automotive businesses and services
- Search, filters and vehicle discovery
- Public Peeks and Peek Requests
- Business profiles and verification flows
- Messaging
- Favourites
- Notifications and Web Push foundations
- Reporting, moderation and administration
- Listing media, location and seller information

Other marketplace categories are not part of the initial public automotive launch. Shared platform foundations should remain reusable so additional categories can be introduced later without rebuilding the product.

## Technology

PeekaListing Automotive is a web-first PWA built with:

- React 18
- Vite 6
- React Router
- Supabase Auth
- PostgreSQL with Row Level Security
- Supabase Storage
- Supabase Edge Functions
- TanStack Query
- Service worker / PWA infrastructure

The application keeps UI, domain logic and backend/provider access separated through reusable services, repositories, hooks and components.

## Local development

### Requirements

- Node.js 24+
- npm
- Docker Desktop for the local Supabase stack
- Supabase CLI

Install dependencies:

```bash
npm ci --ignore-scripts
```

Create the local environment file:

```bash
cp .env.example .env
```

Start the local Supabase stack when backend development is required:

```bash
supabase start
supabase db reset --local --no-seed
```

Use the local public Supabase URL and anon key reported by `supabase status` in `.env`.

Never expose service-role or other privileged secrets through client-side `VITE_` environment variables.

Validate the environment and start the app:

```bash
npm run validate:env
npm run dev
```

## Validation

Run the checks relevant to the change being made. The main repository checks include:

```bash
npm run lint
npm run typecheck
npm run typecheck:active
npm run typecheck:edge-functions
npm run test:contracts
npm run build
```

Database, authentication, messaging, listing, notification, Peek, recommendation and scale-focused test commands are also available in `package.json` for work affecting those areas.

Do not weaken tests, security rules or validation simply to make a change pass.

## Repository structure

The main working areas are:

- `src/` — application UI, hooks, services and domain-facing client code
- `supabase/` — database migrations, tests and Edge Functions
- `tests/` — application and contract tests
- `scripts/` — validation, smoke testing and operational tooling
- `public/` — static and PWA assets
- `docs/` — durable architecture, setup and operational documentation
- `infrastructure/` — infrastructure-related configuration and tooling

## Repository rules

`main` is the canonical branch.

Keep the repository small, readable and intentional:

- Avoid permanent integration, checkpoint, backup or agent-specific branches.
- Use short-lived branches only when isolation is genuinely useful.
- Prefer coherent commits for completed units of work instead of frequent WIP commits.
- Do not commit temporary reports, logs, screenshots, build output, archives or debug dumps.
- Update existing durable documentation instead of creating duplicate reports.
- Reuse existing systems before introducing parallel implementations.

All AI agents and contributors must read [`AGENTS.md`](AGENTS.md) before making changes. It is the authoritative repository operating contract.

## Current repository state

PeekaListing Automotive is now isolated as its own product repository and is ready for the automotive-focused product pass.

The existing application foundation is present, while repository-specific CI and deployment workflows are intentionally inactive until they are reviewed and configured for this product and its environments.

Development should preserve working platform capabilities while reshaping the customer-facing experience around vehicles, dealerships, automotive services and Peeks.
