import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('SQL boundary inspects timestamp migrations without changing numbered release-tip semantics', async () => {
  const gate = await read('scripts/verify-sql-boundary.mjs');
  assert.match(gate, /allMigrationFiles/);
  assert.match(gate, /\^\\d\+_\.\+\\\.sql\$/);
  assert.match(gate, /numberedMigrationFiles/);
  assert.match(gate, /for \(const name of allMigrationFiles\)/);
  assert.match(gate, /inspectSqlText\(name, content\)/);
  assert.match(gate, /RELEASE_TIP_MIGRATION/);
  assert.match(gate, /numberedMigrationFiles\.at\(-1\)/);
});

test('automotive search migration and rollback follow hardened extension and bounded public contracts', async () => {
  const [migration, rollback] = await Promise.all([
    read('supabase/migrations/20260810154000_automotive_model_seller_search.sql'),
    read('supabase/rollback/20260810154000_automotive_model_seller_search.rollback.sql'),
  ]);
  assert.match(migration, /model extensions\.gin_trgm_ops/);
  assert.match(migration, /security definer/);
  assert.match(migration, /set search_path = ''/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /p_limit not between 1 and 50/);
  assert.match(migration, /limit p_limit \+ 1/);
  assert.doesNotMatch(migration.match(/returns table \([\s\S]*?\)\nlanguage plpgsql/)?.[0] || '', /attributes jsonb|description text|contact_phone text|contact_email text/);
  assert.doesNotMatch(rollback, /delete from|truncate|drop table/i);
  assert.match(rollback, /drop index if exists public\.idx_car_details_automotive_model_trgm/);
});
