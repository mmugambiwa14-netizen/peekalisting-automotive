import process from 'node:process';

const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim();
const expectedProjectRef = (
  process.env.PEEKALISTING_EXPECTED_PROJECT_REF
  || process.env.FINDIT_EXPECTED_PROJECT_REF
  || ''
).trim();

const OLD_FINDIT_STAGING_REF = 'bwgklpxoetrrkutottdb';
const FINDIT_MARKETPLACE_REF = 'jvbpxnfxkptuexgssplj';

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
try {
  base = new URL(supabaseUrl);
} catch {
  console.error('Automotive database boundary verification failed: invalid Supabase URL');
  process.exit(2);
}

if (base.protocol !== 'https:' || base.hostname !== `${expectedProjectRef}.supabase.co`) {
  console.error('Automotive database boundary verification failed: Supabase URL/ref mismatch');
  process.exit(1);
}

try {
  const response = await fetch(new URL('/rest/v1/rpc/automotive_release_boundary_ready', base), {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
    },
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

  console.log(`Automotive database release boundary passed for ${expectedProjectRef}.`);
} catch (error) {
  console.error(
    `Automotive database boundary verification failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}
