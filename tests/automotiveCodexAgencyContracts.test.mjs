import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const agentsDir = new URL('../.codex/agents/', import.meta.url);

async function agentSource(name) {
  return readFile(new URL(name, agentsDir), 'utf8');
}

test('PeekaListing Codex Agency keeps a curated 19-agent project roster', async () => {
  const files = (await readdir(agentsDir)).filter((name) => name.endsWith('.toml')).sort();
  assert.equal(files.length, 19);
  assert.ok(files.includes('peekalisting-orchestrator.toml'));
  assert.ok(files.includes('frontend-engineer.toml'));
  assert.ok(files.includes('minimal-change-engineer.toml'));
  assert.ok(files.includes('reality-checker.toml'));

  for (const file of files) {
    const source = await agentSource(file);
    assert.match(source, /^name = ".+"/m);
    assert.match(source, /^description = ".+"/m);
    assert.match(source, /^developer_instructions = '''/m);
    assert.match(source, /AGENTS\.md/);
  }
});

test('frontend engineer has explicit redesign authority over minimal-diff preference', async () => {
  const frontend = await agentSource('frontend-engineer.toml');
  const minimal = await agentSource('minimal-change-engineer.toml');

  assert.match(frontend, /EXPLICIT OWNER-AUTHORIZED REDESIGN RIGHTS/);
  assert.match(frontend, /information architecture/);
  assert.match(frontend, /Minimal Change Engineer may not veto a justified redesign/);
  assert.match(minimal, /Frontend Engineer.*explicit owner-authorized redesign rights/s);
});

test('orchestrator prevents builder self-certification and reality checker gates completion', async () => {
  const orchestrator = await agentSource('peekalisting-orchestrator.toml');
  const reality = await agentSource('reality-checker.toml');

  assert.match(orchestrator, /Never let the builder certify its own work/);
  assert.match(orchestrator, /3-7 active specialists/);
  assert.match(reality, /final certifier/);
  assert.match(reality, /PASS:/);
  assert.match(reality, /NEEDS WORK:/);
  assert.match(reality, /BLOCKED:/);
});
