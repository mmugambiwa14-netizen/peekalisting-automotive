import process from 'node:process';

const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim();
const expectedProjectRef = (
  process.env.PEEKALISTING_EXPECTED_PROJECT_REF
  || process.env.FINDIT_EXPECTED_PROJECT_REF
  || ''
).trim();
const stagingOrigin = (
  process.env.PEEKALISTING_AUTOMOTIVE_STAGING_ORIGIN
  || 'https://cars-staging.peekalisting.com'
).trim().replace(/\/$/, '');

const OLD_FINDIT_STAGING_REF = 'bwgklpxoetrrkutottdb';
const FINDIT_MARKETPLACE_REF = 'jvbpxnfxkptuexgssplj';
const PRIVATE_SCHEMA_REJECTION_CODE = 'PGRST106';
const REQUIRED_EDGE_FUNCTIONS = [
  'listing-image-upload',
  'marketplace-image-upload',
  'delete-account',
];

if (!supabaseUrl || !supabaseAnonKey || !expectedProjectRef) {
  console.error(
    'Automotive database boundary verification requires VITE_SUPABASE_URL, '
    + 'VITE_SUPABASE_ANON_KEY and PEEKALISTING_EXPECTED_PROJECT_REF',
  );
  process.exit(2);
}

if ([OLD_FINDIT_STAGING_REF, FINDIT_MARKETPLACE_REF].includes(expectedProjectRef)) {
  console.error('Automotive database boundary must not target an inherited FindIt Supabase project');
  process.exit(1);
}

let base;
let browserOrigin;
try {
  base = new URL(supabaseUrl);
  browserOrigin = new URL(stagingOrigin);
} catch {
  console.error('Automotive database boundary verification failed: invalid Supabase or staging URL');
  process.exit(2);
}

if (base.protocol !== 'https:' || base.hostname !== `${expectedProjectRef}.supabase.co`) {
  console.error('Automotive database boundary verification failed: Supabase URL/ref mismatch');
  process.exit(1);
}
if (browserOrigin.protocol !== 'https:' || browserOrigin.hostname !== 'cars-staging.peekalisting.com') {
  console.error('Automotive database boundary verification failed: staging origin mismatch');
  process.exit(1);
}

const browserHeaders = {
  apikey: supabaseAnonKey,
  Authorization: `Bearer ${supabaseAnonKey}`,
  'Content-Type': 'application/json',
};

try {
  const response = await fetch(new URL('/rest/v1/rpc/automotive_release_boundary_ready', base), {
    method: 'POST',
    headers: browserHeaders,
    body: '{}',
  });

  if (response.status !== 200) {
    console.error(`Automotive database boundary verification failed: RPC returned HTTP ${response.status}`);
    process.exit(1);
  }

  const ready = await response.json();
  if (ready !== true) {
    console.error('Automotive database boundary verification failed: hosted boundary attestation is not true');
    process.exit(1);
  }

  // Public SECURITY INVOKER wrappers intentionally need EXECUTE on privileged
  // implementations in the private schema. That is safe only while PostgREST
  // refuses to expose the private schema itself. Probe a known private helper
  // using the anonymous browser key and require PostgREST's schema-not-exposed
  // rejection rather than treating function-level auth errors as sufficient.
  const privateSchemaProbe = await fetch(new URL('/rest/v1/rpc/is_admin', base), {
    method: 'POST',
    headers: {
      ...browserHeaders,
      'Accept-Profile': 'private',
      'Content-Profile': 'private',
    },
    body: '{}',
  });

  let privateSchemaBody = null;
  try {
    privateSchemaBody = await privateSchemaProbe.json();
  } catch {
    // A non-JSON response is still a failure below because the verifier expects
    // PostgREST's explicit schema-not-exposed error contract.
  }

  if (
    privateSchemaProbe.status !== 406
    || privateSchemaBody?.code !== PRIVATE_SCHEMA_REJECTION_CODE
  ) {
    console.error(
      'Automotive database boundary verification failed: hosted PostgREST did not explicitly reject the private schema',
    );
    process.exit(1);
  }

  // The minimum automotive browser flows depend on these hosted Edge Functions.
  // OPTIONS is deliberately used as a non-destructive existence + CORS probe:
  // no image is uploaded and the account-deletion path cannot mutate a user.
  for (const functionName of REQUIRED_EDGE_FUNCTIONS) {
    const functionProbe = await fetch(new URL(`/functions/v1/${functionName}`, base), {
      method: 'OPTIONS',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        Origin: browserOrigin.origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization, apikey, content-type, x-client-info',
      },
    });

    if (functionProbe.status !== 204) {
      console.error(
        `Automotive database boundary verification failed: ${functionName} preflight returned HTTP ${functionProbe.status}`,
      );
      process.exit(1);
    }
    if (functionProbe.headers.get('access-control-allow-origin') !== browserOrigin.origin) {
      console.error(
        `Automotive database boundary verification failed: ${functionName} does not allow the automotive staging origin`,
      );
      process.exit(1);
    }
    if (!functionProbe.headers.get('access-control-allow-methods')?.includes('POST')) {
      console.error(
        `Automotive database boundary verification failed: ${functionName} preflight does not allow POST`,
      );
      process.exit(1);
    }
  }

  console.log(
    `Automotive database release boundary passed for ${expectedProjectRef}: database, private schema and core Edge Functions verified.`,
  );
} catch (error) {
  console.error(
    `Automotive database boundary verification failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}
