# Supabase setup

PeekaListing Automotive requires its own Supabase project. The original FindIt projects are reference environments only and must not be used as the automotive staging or production backend.

## Automotive staging target

Create a dedicated project named `PeekaListing Automotive Staging` in the approved Supabase organization. The current repository deployment boundary expects its project ref through `PEEKALISTING_AUTOMOTIVE_STAGING_PROJECT_REF` and rejects both inherited FindIt project refs.

Use `eu-west-2` unless an explicit infrastructure decision changes the region. This matches the existing hosted baseline while keeping the new database independent.

## Local development

Requirements:

- Node.js 24+
- npm
- Docker Desktop
- Supabase CLI

From the repository root:

```bash
npm ci --ignore-scripts
supabase start
supabase db reset --local --no-seed
npm run validate:env
npm run dev
```

Use the local public Supabase URL and publishable/anon key reported by `supabase status`. Never place a service-role, secret, worker, VAPID private, SMTP or provider secret in a browser `VITE_*` variable.

## Database provisioning

A fresh automotive project must receive the repository migration chain in order. Do not cherry-pick only the newest automotive migrations onto an empty database because they depend on the established marketplace, moderation, notification, business, media and Peek schemas.

The automotive tail of the chain includes:

- `20260808000000_automotive_launch_core.sql`
- `20260810150000_automotive_open_vehicle_submission.sql`
- `20260810151000_automotive_search_projection.sql`
- `20260810152000_automotive_service_taxonomy.sql`
- `20260810153000_automotive_dealer_directory.sql`
- `20260810154000_automotive_model_seller_search.sql`
- `20260810155000_automotive_public_dealer_profile_gate.sql`

The full chain also includes later hardening such as `20260810052000_unified_release_gate_repairs.sql`, which moves authenticated Web Push preference implementations behind the private schema and preserves review-before-takedown report semantics.

After migration, run the database/RLS checks and Supabase security advisor before enabling public traffic.

## Core storage and Edge Functions

The first automotive staging acceptance pass needs the existing private storage/media path rather than a parallel upload system.

Core functions to deploy for the basic account, vehicle, dealer and automotive-service journeys:

- `listing-image-upload`
- `marketplace-image-upload`
- `delete-account`

Supabase provides the project URL and project keys to Edge Functions. The upload functions also require the allowed browser origin to include:

`https://cars-staging.peekalisting.com`

Set the existing compatibility variable:

`FINDIT_ALLOWED_ORIGINS=https://cars-staging.peekalisting.com`

The `FINDIT_` prefix is retained for runtime compatibility; it does not mean the function should target a FindIt project.

## Notifications and email

The in-app notification domain is database-backed. Web Push and transactional email are additional runtime layers and should be enabled only after their secrets/providers are configured.

Web Push dispatch requires:

- `PUSH_DISPATCH_TOKEN`
- `WEB_PUSH_PUBLIC_KEY`
- `WEB_PUSH_PRIVATE_KEY`
- `WEB_PUSH_SUBJECT` (for example `mailto:support@peekalisting.com`)

The browser receives only the matching public VAPID key through `VITE_WEB_PUSH_PUBLIC_KEY`.

Transactional email dispatch requires:

- `EMAIL_DISPATCH_TOKEN`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `FINDIT_APP_URL=https://cars-staging.peekalisting.com`

Custom Supabase Auth SMTP is configured separately from the transactional application-email worker.

## Peeks

Peeks are a core product capability but have a larger runtime footprint. Do not enable `VITE_FEATURE_TOURS` merely because the schema exists.

Before enabling Peeks on automotive staging:

1. Deploy the tour upload, completion, feed, playback, processing, lifecycle, cache and observability functions required by the existing Peek architecture.
2. Set `TOURS_BACKEND_ENABLED=true` only after the corresponding workers and worker credentials are ready.
3. Add `https://cars-staging.peekalisting.com` to `FINDIT_ALLOWED_ORIGINS`.
4. Run the car-only hosted Peek verification from `scripts/verify-automotive-staging.mjs`.
5. Validate at least one real car Peek/Peek Request journey end to end before public launch.

Do not copy production worker credentials into staging.

## Hosted Auth requirements

Before public launch, configure and verify the automotive Supabase project itself rather than relying on local `supabase/config.toml` defaults.

Required baseline:

- canonical site URL: `https://cars-staging.peekalisting.com` for staging
- only intentional redirect URLs
- email confirmation enabled
- minimum password policy appropriate for production
- leaked-password protection enabled
- MFA policy reviewed and enabled where required, particularly for administrators
- anonymous sign-in disabled
- phone sign-up disabled unless deliberately introduced
- CAPTCHA/bot protection configured for public auth surfaces
- custom SMTP configured and tested
- Google OAuth enabled only after the provider console callback and complete browser round trip pass
- Apple remains disabled until separately implemented and verified

Admin accounts should receive stronger authentication requirements than ordinary marketplace users.

## Staging verification

The active deployment workflow is `.github/workflows/automotive-staging.yml` and the hosted verifier is `scripts/verify-automotive-staging.mjs`.

The verifier proves:

- the hosted SPA/PWA and security headers
- the configured project is the guarded automotive Supabase project
- Cars V3 public search is callable
- public dealer discovery is callable
- returned car seller identity is `dealer` or `private`
- Google OAuth only when enabled
- car Peek feed only when Peeks are enabled

A new clean staging database is allowed to contain zero listings or dealers. Inventory seeding belongs to the subsequent acceptance phase.

## Production boundary

Production requires a separate Supabase project and separate secrets. Do not promote by changing the automotive staging project into production or by pointing the automotive client at `FindIt Marketplace`.

Promote only after migrations, RLS/security advisor, Auth, Storage, Edge Functions, vehicle submission/moderation, dealer onboarding, search, messaging, reporting, Peeks, notifications and account-management journeys pass against automotive staging.
