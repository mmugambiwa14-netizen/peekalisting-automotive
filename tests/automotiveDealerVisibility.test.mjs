import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('direct public dealer profiles require current approved Cars capability', async () => {
  const [migration, rollback, repository, app] = await Promise.all([
    read('supabase/migrations/20260810155000_automotive_public_dealer_profile_gate.sql'),
    read('supabase/rollback/20260810155000_automotive_public_dealer_profile_gate.rollback.sql'),
    read('src/repositories/businessProfilesRepository.js'),
    read('src/App.jsx'),
  ]);

  assert.match(app, /path="\/dealer\/:id"/);
  assert.match(repository, /\.from\('business_profiles_public'\)/);
  assert.match(migration, /profile\.business_type <> 'car_dealership'/);
  assert.match(migration, /profile\.verified = true/);
  assert.match(migration, /approval\.category = 'car'/);
  assert.match(migration, /approval\.status = 'approved'/);
  assert.match(migration, /owner_user\.status = 'active'/);
  assert.doesNotMatch(rollback, /delete from|truncate|drop table/i);
  assert.doesNotMatch(rollback, /approval\.category = 'car'/);
});

test('database certification covers pending approved and suspended dealer visibility', async () => {
  const pgTap = await read('supabase/tests/v1_automotive_public_dealer_profile_gate.sql');
  assert.match(pgTap, /approved dealer profile is public/);
  assert.match(pgTap, /pending dealer profile is hidden/);
  assert.match(pgTap, /status = 'suspended'/);
  assert.match(pgTap, /suspended dealer profile immediately disappears/);
  assert.match(pgTap, /set local role anon/);
});
