import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('canonical and persisted vehicle fuel vocabularies include alternative powertrains', async () => {
  const [schema, migration] = await Promise.all([
    source('src/domain/listingSchema/categories/vehicle.js'),
    source('supabase/migrations/20260810154000_automotive_fuel_powertrain_alignment.sql'),
  ]);

  assert.match(schema, /'cng'/);
  assert.match(schema, /'plug_in_hybrid'/);
  assert.match(migration, /add value if not exists 'cng'/);
  assert.match(migration, /add value if not exists 'plug_in_hybrid'/);
});
