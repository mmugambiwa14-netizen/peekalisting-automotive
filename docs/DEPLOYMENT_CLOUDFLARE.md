# Cloudflare Pages deployment

Cloudflare Pages is the authoritative web host for PeekaListing Automotive. Supabase remains the backend.

The automotive experiment must stay isolated from the original FindIt/PeekaListing environments until it is deliberately promoted. Do not use either existing FindIt Supabase project as the automotive staging backend.

## Automotive staging boundary

The active staging targets are:

- Cloudflare Pages project: `peekalisting-automotive-staging`
- Custom domain: `https://cars-staging.peekalisting.com`
- GitHub environment: `cloudflare-automotive-staging`
- Supabase: a dedicated PeekaListing Automotive staging project
- Source branch: `main`

The deployment workflow is `.github/workflows/automotive-staging.yml`. It is manual-only and requires the `DEPLOY` confirmation input. It fails closed if the configured Supabase project ref matches either the inherited FindIt Staging or FindIt Marketplace project.

Historical deployment workflows remain under `.github/source-workflows/` as reference material only. They are not the automotive deployment path and must not be re-enabled wholesale because several target the original staging environment, production-shaped workers, or inherited secrets.

## Required GitHub environment configuration

Configure these on the `cloudflare-automotive-staging` GitHub environment before the first deployment.

Variables:

- `CLOUDFLARE_ACCOUNT_ID`
- `PEEKALISTING_AUTOMOTIVE_STAGING_PROJECT_REF`
- `VITE_SUPABASE_URL`

Secrets:

- `CLOUDFLARE_API_TOKEN`
- `VITE_SUPABASE_ANON_KEY`

The Supabase URL must be exactly `https://<PEEKALISTING_AUTOMOTIVE_STAGING_PROJECT_REF>.supabase.co`.

Optional feature configuration can be added only after the corresponding backend/provider is ready:

- Google Auth: `VITE_AUTH_GOOGLE_ENABLED`, `VITE_FEATURE_GOOGLE_OAUTH`
- Maps/location: `VITE_FEATURE_MAPS`, `VITE_FEATURE_CURRENT_LOCATION`, `VITE_MAPTILER_PUBLIC_KEY`, `VITE_MAPTILER_STYLE_ID`
- Web Push: `VITE_WEB_PUSH_PUBLIC_KEY` plus the private Edge Function secrets documented in `ENVIRONMENT_VARIABLES.md`
- Peeks: `VITE_FEATURE_TOURS`, `TOURS_BACKEND_ENABLED`, the inherited compatibility worker switches and their worker secrets

The workflow defaults optional integrations off. This allows the isolated application and database to be proven before OAuth, maps, Web Push or Peek workers are activated.

## What the staging deployment proves

Before uploading, the workflow:

1. Confirms it is running from the exact `main` commit.
2. Rejects both inherited FindIt Supabase project refs.
3. Validates environment configuration.
4. Runs the active automotive contract gate.
5. Builds the PWA and runs deployment-security checks.
6. Deploys only to `peekalisting-automotive-staging` and `cars-staging.peekalisting.com`.
7. Stamps the exact Git commit and automotive Supabase project ref into the deployed build identity.
8. Runs `scripts/verify-automotive-staging.mjs` against the hosted application.

The hosted verifier checks the SPA/PWA/security-header boundary and the dedicated Supabase connection. It exercises `public_listing_search_card_page_v3` with `p_kind: 'car'` and the automotive dealer directory. A new clean staging database may contain zero listings or dealers; inventory seeding is a separate acceptance phase.

Google OAuth and the car Peek feed are verified only when those capabilities are explicitly enabled.

## Supabase requirements before first deployment

A dedicated automotive Supabase project must receive the repository migration chain, including the automotive migrations for:

- open vehicle submission with moderation before publication
- automotive V2/V3 search projection and model/seller filters
- automotive services taxonomy
- public dealer directory
- public dealer-profile approval gate

The required Edge Functions must then be deployed for each enabled runtime capability. Do not copy service-role keys, worker credentials, VAPID private keys or provider secrets into browser `VITE_*` variables.

Hosted Auth must be configured independently for the automotive project. Before public release, verify the canonical site URL and redirects, email confirmations, password policy, leaked-password protection, MFA policy, CAPTCHA/bot protection, custom SMTP and any enabled OAuth provider.

## Production

The production PeekaListing Automotive deployment remains blocked until the dedicated staging backend and the real-user automotive acceptance journeys pass. Do not attach `peekalisting.com` or reuse FindIt Marketplace credentials merely to bypass staging.

Production promotion must use a separate protected environment, separate Supabase credentials, a `main`-only deployment policy and explicit owner approval.
