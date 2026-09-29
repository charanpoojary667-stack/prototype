import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve(import.meta.dirname, '..');
const work = await mkdtemp(join(tmpdir(), 'dogfood-workflow-'));
const port = 20000 + Math.floor(Math.random() * 30000);
const base = `http://127.0.0.1:${port}/api`;
const testSecret = 'workflow-check-secret-at-least-32-characters-long';
const jwtIssuer = 'dogfood-judging-api';
const jwtAudience = 'dogfood-judging-platform';
const childEnv = { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_FILE: join(work, 'db.json'), JWT_SECRET: testSecret, JWT_ISSUER: jwtIssuer, JWT_AUDIENCE: jwtAudience, ORGANIZER_INVITE_CODE: 'check-organizer', JUDGE_INVITE_CODE: 'check-judge', NODE_ENV: 'test' };
delete childEnv.DATABASE_URL;
const server = spawn(process.execPath, ['src/server.js'], { cwd: root, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
let logs = '';
server.stdout.on('data', chunk => { logs += chunk.toString(); });
server.stderr.on('data', chunk => { logs += chunk.toString(); });

async function request(path, method = 'GET', token, data, expected = 200) {
  const response = await fetch(`${base}${path}`, { method, headers: { ...(data ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
  const result = await response.json();
  assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(result)}`);
  return result;
}

function signTestToken(claims, header = { alg: 'HS256', typ: 'JWT' }) {
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedClaims = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const unsigned = `${encodedHeader}.${encodedClaims}`;
  return `${unsigned}.${createHmac('sha256', testSecret).update(unsigned).digest('base64url')}`;
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error(`API exited before starting:\n${logs}`);
    try { ready = (await fetch(`${base}/health`)).ok; } catch {}
    if (ready) break;
    await delay(250);
  }
  assert.ok(ready, `API did not start:\n${logs}`);

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const organizer = await request('/auth/register', 'POST', null, { name: 'Workflow Organizer', email: `organizer-${suffix}@example.test`, password: 'CheckPass123!', role: 'organizer', inviteCode: 'check-organizer' }, 201);
  const judge = await request('/auth/register', 'POST', null, { name: 'Workflow Judge', email: `judge-${suffix}@example.test`, password: 'CheckPass123!', role: 'judge', inviteCode: 'check-judge' }, 201);
  const otherJudge = await request('/auth/register', 'POST', null, { name: 'Other Workflow Judge', email: `other-judge-${suffix}@example.test`, password: 'CheckPass123!', role: 'judge', inviteCode: 'check-judge' }, 201);
  const participant = await request('/auth/register', 'POST', null, { name: 'Workflow Participant', email: `participant-${suffix}@example.test`, password: 'CheckPass123!' }, 201);
  const jwtParts = participant.token.split('.');
  assert.equal(jwtParts.length, 3, 'access token should use the standard three-part JWT format');
  const jwtHeader = JSON.parse(Buffer.from(jwtParts[0], 'base64url').toString());
  const jwtClaims = JSON.parse(Buffer.from(jwtParts[1], 'base64url').toString());
  assert.deepEqual(jwtHeader, { alg: 'HS256', typ: 'JWT' });
  assert.equal(jwtClaims.sub, participant.user.id);
  assert.match(jwtClaims.sub, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.equal(jwtClaims.iss, jwtIssuer);
  assert.equal(jwtClaims.aud, jwtAudience);
  assert.ok(Number.isInteger(jwtClaims.iat) && Number.isInteger(jwtClaims.exp));
  assert.equal(jwtClaims.exp - jwtClaims.iat, 7 * 24 * 60 * 60);
  assert.equal((await request('/auth/me', 'GET', participant.token)).user.role, 'participant');
  const wrongAudience = signTestToken({ ...jwtClaims, aud: 'some-other-service' });
  await request('/auth/me', 'GET', wrongAudience, undefined, 401);
  const expiredToken = signTestToken({ ...jwtClaims, iat: Math.floor(Date.now() / 1000) - 120, exp: Math.floor(Date.now() / 1000) - 60 });
  await request('/auth/me', 'GET', expiredToken, undefined, 401);
  const alteredSignature = `${jwtParts[2][0] === 'A' ? 'B' : 'A'}${jwtParts[2].slice(1)}`;
  await request('/auth/me', 'GET', `${jwtParts[0]}.${jwtParts[1]}.${alteredSignature}`, undefined, 401);
  await request('/auth/login', 'POST', null, { email: `participant-${suffix}@example.test`, password: 'CheckPass123!' });

  const startAt = new Date(Date.now() + 86400000).toISOString();
  const endAt = new Date(Date.now() + 172800000).toISOString();
  const created = await request('/events', 'POST', organizer.token, { title: 'Workflow Check Hackathon', description: 'Automated integration workflow', startAt, endAt }, 201);
  const eventId = created.event.id;
  const criteria = [{ name: 'Functionality', maxScore: 10 }, { name: 'Quality', maxScore: 10 }, { name: 'Innovation', maxScore: 10 }];
  const rubric = await request(`/events/${eventId}/rubric`, 'PUT', organizer.token, { criteria });
  const track = await request(`/events/${eventId}/tracks`, 'POST', organizer.token, { name: 'Web', description: 'Web projects', criteria }, 201);
  await request(`/events/${eventId}/judges`, 'POST', organizer.token, { email: `judge-${suffix}@example.test` }, 201);
  await request(`/events/${eventId}/judges`, 'POST', organizer.token, { email: `other-judge-${suffix}@example.test` }, 201);
  await request(`/events/${eventId}/tracks/${track.track.id}/judges`, 'POST', organizer.token, { email: `judge-${suffix}@example.test` }, 201);
  await request(`/events/${eventId}/publish`, 'POST', organizer.token, {});

  await request(`/events/${eventId}/register`, 'POST', participant.token, {}, 201);
  const team = await request('/teams', 'POST', participant.token, { eventId, name: 'Workflow Team' }, 201);
  const submission = await request(`/teams/${team.team.id}/submissions`, 'POST', participant.token, { trackId: track.track.id, title: 'Workflow Project', summary: 'A project created by the automated full workflow check.', repositoryUrl: 'https://example.test/repository' }, 201);
  let assigned = await request(`/events/${eventId}/judging-assignments`, 'GET', judge.token);
  assert.equal(assigned.assignments.length, 1, `track eligibility should exclude the other event judge: ${JSON.stringify(assigned.assignments)}`);
  await request(`/judging-assignments/${assigned.assignments[0].id}`, 'PATCH', judge.token, { status: 'in_progress' });
  await request(`/submissions/${submission.submission.id}/scores`, 'PUT', judge.token, { final: true, scores: track.track.rubric.map((criterion, index) => ({ criterionId: criterion.id, score: [8, 9, 7][index], feedback: 'Verified by workflow check.' })) });
  const recorded = await request(`/submissions/${submission.submission.id}/scores`, 'GET', judge.token);
  assert.equal(recorded.scores.length, 3);
  assert.ok(recorded.scores.every(score => score.judgingAssignmentId === assigned.assignments[0].id));
  assigned = await request(`/events/${eventId}/judging-assignments`, 'GET', judge.token);
  assert.equal(assigned.assignments[0].status, 'completed');
  await request(`/events/${eventId}/complete`, 'POST', organizer.token, {});
  await request(`/events/${eventId}/results/publish`, 'POST', organizer.token, { public: true });
  const board = await request(`/events/${eventId}/leaderboard`, 'GET', participant.token);
  assert.equal(board.leaderboard[0].team.name, 'Workflow Team');
  assert.equal(board.leaderboard[0].score, 80);
  console.log('PASS: registration, login, relational rubric criteria, tracks, track eligibility, submissions, assignment states, scores, and leaderboard.');
} catch (error) {
  console.error(error);
  if (logs) console.error(logs);
  process.exitCode = 1;
} finally {
  server.kill('SIGTERM');
  await Promise.race([new Promise(resolveClose => server.once('exit', resolveClose)), delay(3000)]);
  await rm(work, { recursive: true, force: true });
}
