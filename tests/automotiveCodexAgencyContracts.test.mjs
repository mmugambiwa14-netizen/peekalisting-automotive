import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const agentsDir = new URL('../.codex/agents/', import.meta.url);
const missionUrl = new URL('../.codex/missions/full-app-sequential.md', import.meta.url);

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

test('full-app mission is sequential and hard-stops for owner frontend preview approval', async () => {
  const [orchestrator, mission] = await Promise.all([
    agentSource('peekalisting-orchestrator.toml'),
    readFile(missionUrl, 'utf8'),
  ]);

  assert.match(mission, /Status: ACTIVE OWNER-DIRECTED MISSION/);
  assert.match(mission, /Work sequentially\. Do not run implementation workstreams in parallel/);
  assert.match(mission, /# PHASE 1 — FRONTEND FIRST/);
  assert.match(mission, /# OWNER PREVIEW GATE — HARD STOP/);
  assert.match(mission, /DO NOT START PHASE 2 OR ANY LATER PHASE UNTIL THE OWNER EXPLICITLY APPROVES THE FRONTEND PREVIEW/);
  assert.match(mission, /https:\/\/cars-staging\.peekalisting\.com/);
  assert.match(mission, /# PHASE 2 — BACKEND AND DOMAIN WORKFLOWS/);
  assert.match(mission, /# PHASE 9 — PRODUCT AND DEALER LAUNCH READINESS/);

  const frontendIndex = mission.indexOf('# PHASE 1 — FRONTEND FIRST');
  const previewIndex = mission.indexOf('# OWNER PREVIEW GATE — HARD STOP');
  const backendIndex = mission.indexOf('# PHASE 2 — BACKEND AND DOMAIN WORKFLOWS');
  assert.ok(frontendIndex >= 0 && previewIndex > frontendIndex && backendIndex > previewIndex);

  assert.match(orchestrator, /check `\.codex\/missions\/full-app-sequential\.md`/);
  assert.match(orchestrator, /OWNER PREVIEW GATE as a HARD STOP/);
  assert.match(orchestrator, /Do not start Phase 2 or any later phase until the owner explicitly approves the preview/);
});
