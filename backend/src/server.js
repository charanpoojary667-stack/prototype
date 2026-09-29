import { createServer } from 'node:http';
import { randomUUID, randomBytes, scrypt as scryptCallback, timingSafeEqual, createHmac } from 'node:crypto';
import { promisify } from 'node:util';
import { beginRequest, closeStore, db, finishRequest, initializeStore, persist, runLocalSerial, storageKind } from './storage.js';

const scrypt = promisify(scryptCallback);
const PORT = Number(process.env.PORT || 4000);
const HOST = process.env.HOST || '0.0.0.0';
const SECRET = process.env.JWT_SECRET || 'development-only-change-this-secret';
const JWT_ISSUER = process.env.JWT_ISSUER || 'dogfood-judging-api';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'dogfood-judging-platform';
const JWT_TTL_SECONDS = 7 * 24 * 60 * 60;
const MAX_BODY = 1024 * 1024;
const ROLES = ['organizer', 'judge', 'participant'];

const fail = (status, message) => Object.assign(new Error(message), { status });
const id = () => randomUUID();
const now = () => new Date().toISOString();
const cleanUser = ({ passwordHash, ...user }) => user;

async function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const derived = await scrypt(password, salt, 64);
  return `${salt}:${derived.toString('hex')}`;
}
async function verifyPassword(password, stored) {
  const [salt, expectedHex] = (stored || '').split(':');
  if (!salt || !expectedHex) return false;
  const actual = await scrypt(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
function tokenFor(user) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const issuedAt = Math.floor(Date.now() / 1000);
  const claims = Buffer.from(JSON.stringify({
    sub: user.id,
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
    iat: issuedAt,
    exp: issuedAt + JWT_TTL_SECONDS,
  })).toString('base64url');
  const unsigned = `${header}.${claims}`;
  const signature = createHmac('sha256', SECRET).update(unsigned).digest('base64url');
  return `${unsigned}.${signature}`;
}
function authenticate(req) {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) throw fail(401, 'Authentication required');
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some(part => !part)) throw fail(401, 'Invalid or expired token');
  const [encodedHeader, encodedClaims, encodedSignature] = parts;
  const unsigned = `${encodedHeader}.${encodedClaims}`;
  const expected = createHmac('sha256', SECRET).update(unsigned).digest();
  let supplied;
  try { supplied = Buffer.from(encodedSignature, 'base64url'); } catch { throw fail(401, 'Invalid or expired token'); }
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw fail(401, 'Invalid or expired token');
  let header; let claims;
  try {
    header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString());
    claims = JSON.parse(Buffer.from(encodedClaims, 'base64url').toString());
  } catch { throw fail(401, 'Invalid or expired token'); }
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (header.alg !== 'HS256' || header.typ !== 'JWT'
      || typeof claims.sub !== 'string'
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(claims.sub)
      || claims.iss !== JWT_ISSUER
      || claims.aud !== JWT_AUDIENCE
      || !Number.isInteger(claims.iat)
      || !Number.isInteger(claims.exp)
      || claims.exp <= claims.iat
      || claims.exp <= nowSeconds
      || claims.iat > nowSeconds + 60) throw fail(401, 'Invalid or expired token');
  const user = db.users.find(item => item.id === claims.sub);
  if (!user) throw fail(401, 'Account no longer exists');
  return user;
}
function allow(user, ...roles) { if (!roles.includes(user.role)) throw fail(403, 'You do not have permission to perform this action'); }
function eventOr404(eventId) { const event = db.events.find(item => item.id === eventId); if (!event) throw fail(404, 'Event not found'); return event; }
function teamOr404(teamId) { const team = db.teams.find(item => item.id === teamId); if (!team) throw fail(404, 'Team not found'); return team; }
function isMember(user, team) { return team.memberIds.includes(user.id); }
function isEventOrganizer(user, event) { return user.role === 'organizer' && event.organizerId === user.id; }
function canJudge(user, eventId) { return db.assignments.some(a => a.eventId === eventId && a.judgeId === user.id); }
function criteriaFor(eventId, trackId = null) {
  const criteria = db.criteria.filter(c => c.eventId === eventId && (trackId ? c.trackId === trackId : !c.trackId)).sort((a,b) => a.position-b.position);
  return trackId && !criteria.length ? criteriaFor(eventId) : criteria;
}
function judgeEligible(judgeId, eventId, trackId) {
  if (!trackId) return true;
  const eligible = db.judgeTrackEligibility.filter(item => item.eventId === eventId && item.trackId === trackId);
  return !eligible.length || eligible.some(item => item.judgeId === judgeId);
}
function ensureJudgingAssignment(submission, event, judgeId) {
  let assignment = db.judgingAssignments.find(a => a.submissionId === submission.id && a.judgeId === judgeId);
  if (!assignment) {
    assignment = { id: id(), eventId: event.id, submissionId: submission.id, judgeId, status: 'assigned', overallFeedback: '', assignedAt: now(), startedAt: null, completedAt: null };
    db.judgingAssignments.push(assignment);
  }
  return assignment;
}
function assignEligibleJudges(submission, event) {
  for (const assignment of db.assignments.filter(a => a.eventId === event.id)) {
    if (judgeEligible(assignment.judgeId, event.id, submission.trackId)) ensureJudgingAssignment(submission, event, assignment.judgeId);
  }
}
function eventAccess(user, eventId) {
  const event = eventOr404(eventId);
  if (isEventOrganizer(user, event) || (user.role === 'judge' && canJudge(user, eventId))) return event;
  if (user.role === 'participant' && db.teams.some(t => t.eventId === eventId && isMember(user, t))) return event;
  throw fail(403, 'You do not have access to this event');
}
function validateString(value, name, min = 1, max = 500) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) throw fail(400, `${name} must be ${min}-${max} characters`);
  return value.trim();
}
function makeCriterion(input, eventId, trackId, position) {
  const name = validateString(input.name, 'criterion name', 2, 80);
  const criterionId = input.id || id();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(criterionId)) throw fail(400, 'criterion id must be a UUID');
  const maxScore = Number(input.maxScore ?? 10);
  if (!Number.isInteger(maxScore) || maxScore < 1 || maxScore > 100) throw fail(400, `maxScore for ${name} must be an integer from 1 to 100`);
  return { id: criterionId, eventId, trackId, name, description: String(input.description || '').trim().slice(0, 500), maxScore, position };
}
function validateEmail(value) {
  const email = validateString(value, 'email', 3, 254).toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw fail(400, 'Enter a valid email address');
  return email;
}
function parseDate(value, name) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) throw fail(400, `${name} must be a valid date`);
  return date.toISOString();
}
async function body(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > MAX_BODY) throw fail(413, 'Request body is too large');
  }
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw fail(400, 'Request body must be valid JSON'); }
}
function send(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(JSON.stringify(data));
}
function publicTeam(team) {
  return { ...team, members: team.memberIds.map(memberId => { const u = db.users.find(x => x.id === memberId); return u ? cleanUser(u) : null; }).filter(Boolean) };
}
function leaderboard(eventId) {
  const teams = db.teams.filter(t => t.eventId === eventId);
  const results = teams.map(team => {
    const submissions = db.submissions.filter(s => s.teamId === team.id);
    const latest = submissions.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const scores = latest ? db.scores.filter(s => s.submissionId === latest.id) : [];
    const categories = {};
    for (const score of scores) {
      categories[score.criterionId] ||= { total: 0, count: 0 };
      categories[score.criterionId].total += score.score;
      categories[score.criterionId].count++;
    }
    const total = scores.reduce((sum, item) => sum + item.score, 0);
    const judgeCount = new Set(scores.map(s => s.judgeId)).size;
    const criterionCount = criteriaFor(eventId, latest?.trackId || null).length;
    return { team: publicTeam(team), submission: latest || null, score: judgeCount ? Number((total / judgeCount).toFixed(2)) : null, completedJudges: criterionCount ? Math.floor(scores.length / criterionCount) : 0, categories: Object.fromEntries(Object.entries(categories).map(([key, value]) => [key, Number((value.total / value.count).toFixed(2))])) };
  });
  return results.sort((a, b) => (b.score ?? -1) - (a.score ?? -1)).map((item, index) => ({ rank: index + 1, ...item }));
}

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname.replace(/\/$/, '') || '/';
  const parts = path.split('/').filter(Boolean);
  const method = req.method || 'GET';
  const input = ['POST', 'PUT', 'PATCH'].includes(method) ? await body(req) : {};
  if (method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS', 'access-control-allow-headers': 'Content-Type,Authorization' }); return res.end(); }
  if (method === 'GET' && path === '/api/health') return send(res, 200, { status: 'ok', timestamp: now() });

  if (method === 'POST' && path === '/api/auth/register') {
    const name = validateString(input.name, 'name', 2, 100);
    const email = validateEmail(input.email);
    if (typeof input.password !== 'string' || input.password.length < 8 || input.password.length > 128) throw fail(400, 'password must be 8-128 characters');
    const role = input.role || 'participant';
    if (!ROLES.includes(role)) throw fail(400, `role must be one of: ${ROLES.join(', ')}`);
    if (role !== 'participant') {
      const inviteCode = role === 'organizer' ? process.env.ORGANIZER_INVITE_CODE : process.env.JUDGE_INVITE_CODE;
      if (!inviteCode || input.inviteCode !== inviteCode) throw fail(403, `A valid ${role} invite code is required`);
    }
    if (db.users.some(u => u.email === email)) throw fail(409, 'An account with this email already exists');
    const user = { id: id(), name, email, role, passwordHash: await hashPassword(input.password), createdAt: now() };
    db.users.push(user); await persist();
    return send(res, 201, { user: cleanUser(user), token: tokenFor(user) });
  }
  if (method === 'POST' && path === '/api/auth/login') {
    const email = validateEmail(input.email);
    const user = db.users.find(u => u.email === email);
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) throw fail(401, 'Email or password is incorrect');
    return send(res, 200, { user: cleanUser(user), token: tokenFor(user) });
  }

  const user = authenticate(req);
  if (method === 'GET' && path === '/api/auth/me') return send(res, 200, { user: cleanUser(user) });

  if (parts[0] === 'api' && parts[1] === 'events' && parts.length === 2) {
    if (method === 'POST') {
      allow(user, 'organizer');
      const title = validateString(input.title, 'title', 3, 120);
      const startAt = parseDate(input.startAt, 'startAt');
      const endAt = parseDate(input.endAt, 'endAt');
      if (new Date(endAt) <= new Date(startAt)) throw fail(400, 'endAt must be after startAt');
      const event = { id: id(), organizerId: user.id, title, description: String(input.description || '').trim().slice(0, 5000), venue: String(input.venue || '').trim().slice(0, 200), startAt, endAt, status: 'draft', rubric: [], createdAt: now(), updatedAt: now() };
      db.events.push(event); await persist(); return send(res, 201, { event });
    }
    if (method === 'GET') {
      const visible = db.events.filter(e => isEventOrganizer(user, e) || canJudge(user, e.id) || db.teams.some(t => t.eventId === e.id && isMember(user, t)));
      return send(res, 200, { events: visible });
    }
  }
  if (parts[0] === 'api' && parts[1] === 'events' && parts[2]) {
    const eventId = parts[2];
    const event = eventOr404(eventId);
    const owns = isEventOrganizer(user, event);
    if (parts.length === 3 && method === 'GET') { eventAccess(user, eventId); return send(res, 200, { event }); }
    if (parts.length === 3 && method === 'PATCH') {
      allow(user, 'organizer'); if (!owns) throw fail(403, 'Only the event organizer can update this event');
      if (event.status === 'completed') throw fail(409, 'Completed events cannot be changed');
      for (const field of ['title', 'description', 'venue']) if (input[field] !== undefined) event[field] = field === 'title' ? validateString(input[field], field, 3, 120) : String(input[field]).trim().slice(0, 5000);
      if (input.startAt !== undefined) event.startAt = parseDate(input.startAt, 'startAt');
      if (input.endAt !== undefined) event.endAt = parseDate(input.endAt, 'endAt');
      if (new Date(event.endAt) <= new Date(event.startAt)) throw fail(400, 'endAt must be after startAt');
      event.updatedAt = now(); await persist(); return send(res, 200, { event });
    }
    if (parts[3] === 'tracks' && parts.length === 4 && method === 'GET') {
      eventAccess(user, eventId);
      return send(res, 200, { tracks: db.tracks.filter(t => t.eventId === eventId).map(track => ({ ...track, rubric: criteriaFor(eventId, track.id) })) });
    }
    if (parts[3] === 'tracks' && parts.length === 4 && method === 'POST') {
      allow(user, 'organizer'); if (!owns) throw fail(403, 'Only the event organizer can create tracks');
      if (event.status !== 'draft') throw fail(409, 'Tracks can only be changed while the event is a draft');
      const name = validateString(input.name, 'name', 2, 100);
      if (db.tracks.some(t => t.eventId === eventId && t.name.toLowerCase() === name.toLowerCase())) throw fail(409, 'A track with this name already exists');
      let trackRubric = [];
      if (input.criteria !== undefined) {
        if (!Array.isArray(input.criteria) || input.criteria.length < 1 || input.criteria.length > 12) throw fail(400, 'criteria must contain 1-12 items');
        const seen = new Set();
        trackRubric = input.criteria.map((criterion, position) => {
          const item = makeCriterion(criterion, eventId, 'pending', position);
          if (seen.has(item.name.toLowerCase())) throw fail(400, 'Rubric criterion names must be unique');
          seen.add(item.name.toLowerCase()); return item;
        });
      }
      const track = { id: id(), eventId, name, description: String(input.description || '').trim().slice(0, 1000), createdAt: now() };
      db.tracks.push(track);
      for (const criterion of trackRubric) db.criteria.push({ ...criterion, trackId: track.id });
      await persist(); return send(res, 201, { track: { ...track, rubric: criteriaFor(eventId, track.id) } });
    }
    if (parts[3] === 'tracks' && parts[4] && parts[5] === 'judges' && method === 'POST') {
      allow(user, 'organizer'); if (!owns) throw fail(403, 'Only the event organizer can set track judge eligibility');
      const track = db.tracks.find(t => t.id === parts[4] && t.eventId === eventId);
      if (!track) throw fail(404, 'Track not found');
      const judge = db.users.find(u => u.email === validateEmail(input.email) && u.role === 'judge');
      if (!judge) throw fail(404, 'Judge account not found');
      if (!canJudge(judge, eventId)) throw fail(409, 'Assign the judge to the event before setting track eligibility');
      let eligibility = db.judgeTrackEligibility.find(item => item.trackId === track.id && item.judgeId === judge.id);
      const nextEligibleJudgeIds = new Set([...db.judgeTrackEligibility.filter(item => item.trackId === track.id).map(item => item.judgeId), judge.id]);
      const excludedBeforeUpdate = db.judgingAssignments.filter(a => a.eventId === eventId && db.submissions.some(s => s.id === a.submissionId && s.trackId === track.id) && !nextEligibleJudgeIds.has(a.judgeId));
      const excludedBeforeIds = new Set(excludedBeforeUpdate.map(a => a.id));
      if (db.scores.some(score => excludedBeforeIds.has(score.judgingAssignmentId))) throw fail(409, 'Track eligibility cannot change after an excluded judge has submitted scores');
      if (!eligibility) {
        eligibility = { id: id(), eventId, trackId: track.id, judgeId: judge.id, createdAt: now() };
        db.judgeTrackEligibility.push(eligibility);
      }
      const excluded = excludedBeforeUpdate;
      db.judgingAssignments = db.judgingAssignments.filter(a => !excluded.includes(a));
      const excludedIds = new Set(excluded.map(a => a.id));
      db.scores = db.scores.filter(score => !excludedIds.has(score.judgingAssignmentId));
      for (const submission of db.submissions.filter(s => s.trackId === track.id)) ensureJudgingAssignment(submission, event, judge.id);
      await persist(); return send(res, 201, { eligibility, judge: cleanUser(judge) });
    }
    if (parts[3] === 'judging-assignments' && method === 'GET') {
      if (!owns && !(user.role === 'judge' && canJudge(user, eventId))) throw fail(403, 'Only the organizer and assigned judges can list judging assignments');
      const assignments = db.judgingAssignments.filter(a => a.eventId === eventId && (owns || a.judgeId === user.id));
      return send(res, 200, { assignments });
    }
    if (parts[3] === 'rubric' && method === 'PUT') {
      allow(user, 'organizer'); if (!owns) throw fail(403, 'Only the event organizer can update the rubric');
      if (event.status !== 'draft') throw fail(409, 'Rubric can only be changed while the event is a draft');
      if (!Array.isArray(input.criteria) || input.criteria.length < 1 || input.criteria.length > 12) throw fail(400, 'criteria must contain 1-12 items');
      const seen = new Set();
      const rubric = input.criteria.map((criterion, position) => {
        const item = makeCriterion(criterion, eventId, null, position);
        if (seen.has(item.name.toLowerCase())) throw fail(400, 'Rubric criterion names must be unique');
        seen.add(item.name.toLowerCase());
        return item;
      });
      db.criteria = db.criteria.filter(criterion => criterion.eventId !== eventId || criterion.trackId !== null);
      db.criteria.push(...rubric);
      event.rubric = rubric.map(({ id: criterionId, name, description, maxScore }) => ({ id: criterionId, name, description, maxScore }));
      event.updatedAt = now(); await persist(); return send(res, 200, { rubric: event.rubric });
    }
    if (parts[3] === 'judges' && method === 'POST') {
      allow(user, 'organizer'); if (!owns) throw fail(403, 'Only the event organizer can assign judges');
      const judge = db.users.find(u => u.email === validateEmail(input.email));
      if (!judge || judge.role !== 'judge') throw fail(404, 'Judge account not found');
      if (!db.assignments.some(a => a.eventId === eventId && a.judgeId === judge.id)) db.assignments.push({ id: id(), eventId, judgeId: judge.id, createdAt: now() });
      for (const submission of db.submissions.filter(s => s.trackId === null || judgeEligible(judge.id, eventId, s.trackId))) ensureJudgingAssignment(submission, event, judge.id);
      await persist(); return send(res, 201, { assignment: db.assignments.find(a => a.eventId === eventId && a.judgeId === judge.id), judge: cleanUser(judge) });
    }
    if (parts[3] === 'judges' && parts[4] && method === 'DELETE') {
      allow(user, 'organizer'); if (!owns) throw fail(403, 'Only the event organizer can remove judges');
      db.assignments = db.assignments.filter(a => !(a.eventId === eventId && a.judgeId === parts[4]));
      db.judgeTrackEligibility = db.judgeTrackEligibility.filter(a => !(a.eventId === eventId && a.judgeId === parts[4]));
      await persist(); return send(res, 200, { removed: true });
    }
    if (parts[3] === 'publish' && method === 'POST') {
      allow(user, 'organizer'); if (!owns) throw fail(403, 'Only the event organizer can publish this event');
      if (event.status !== 'draft') throw fail(409, 'Only draft events can be published');
      if (!criteriaFor(eventId).length && !db.tracks.some(track => track.eventId === eventId && criteriaFor(eventId, track.id).length)) throw fail(400, 'Add at least one rubric criterion before publishing');
      event.status = 'published'; event.updatedAt = now(); await persist(); return send(res, 200, { event });
    }
    if (parts[3] === 'complete' && method === 'POST') {
      allow(user, 'organizer'); if (!owns) throw fail(403, 'Only the event organizer can complete this event');
      if (event.status !== 'published') throw fail(409, 'Only published events can be completed');
      event.status = 'completed'; event.updatedAt = now(); await persist(); return send(res, 200, { event });
    }
    if (parts[3] === 'teams' && method === 'GET') { eventAccess(user, eventId); return send(res, 200, { teams: db.teams.filter(t => t.eventId === eventId).map(publicTeam) }); }
    if (parts[3] === 'leaderboard' && method === 'GET') {
      if (!owns && user.role !== 'judge' && event.status !== 'completed') throw fail(403, 'Leaderboard is available to participants after the event is completed');
      if (user.role === 'judge' && !canJudge(user, eventId)) throw fail(403, 'You are not assigned to this event');
      return send(res, 200, { leaderboard: leaderboard(eventId) });
    }
    if (parts[3] === 'submissions' && method === 'GET') {
      if (!owns && user.role !== 'judge') throw fail(403, 'Only organizers and judges can view all submissions');
      if (user.role === 'judge' && !canJudge(user, eventId)) throw fail(403, 'You are not assigned to this event');
      return send(res, 200, { submissions: db.submissions.filter(s => teamOr404(s.teamId).eventId === eventId) });
    }
  }

  if (parts[0] === 'api' && parts[1] === 'teams') {
    if (parts.length === 2 && method === 'POST') {
      allow(user, 'participant');
      const event = eventOr404(input.eventId);
      if (event.status !== 'published') throw fail(409, 'Teams can only be created for published events');
      if (db.teams.some(t => t.eventId === event.id && t.memberIds.includes(user.id))) throw fail(409, 'You already belong to a team in this event');
      const team = { id: id(), eventId: event.id, name: validateString(input.name, 'name', 2, 80), memberIds: [user.id], createdBy: user.id, createdAt: now() };
      db.teams.push(team); await persist(); return send(res, 201, { team: publicTeam(team) });
    }
    if (parts[2] && parts[3] === 'join' && method === 'POST') {
      allow(user, 'participant'); const team = teamOr404(parts[2]); const event = eventOr404(team.eventId);
      if (event.status !== 'published') throw fail(409, 'You can only join a team in a published event');
      if (team.memberIds.length >= 6) throw fail(409, 'Teams can have at most 6 members');
      if (db.teams.some(t => t.eventId === event.id && t.memberIds.includes(user.id))) throw fail(409, 'You already belong to a team in this event');
      team.memberIds.push(user.id); await persist(); return send(res, 200, { team: publicTeam(team) });
    }
    if (parts[2] && parts[3] === 'submissions' && method === 'POST') {
      allow(user, 'participant'); const team = teamOr404(parts[2]); const event = eventOr404(team.eventId);
      if (!isMember(user, team)) throw fail(403, 'Only team members can submit a project');
      if (event.status !== 'published') throw fail(409, 'Submissions are only open for published events');
      const trackId = input.trackId || null;
      if (trackId && !db.tracks.some(track => track.id === trackId && track.eventId === event.id)) throw fail(400, 'trackId must identify a track in this event');
      if (!criteriaFor(event.id, trackId).length) throw fail(409, 'This submission has no scoring rubric; choose a track with criteria');
      const submission = { id: id(), teamId: team.id, trackId, title: validateString(input.title, 'title', 2, 150), summary: validateString(input.summary, 'summary', 5, 2000), repositoryUrl: input.repositoryUrl ? validateString(input.repositoryUrl, 'repositoryUrl', 8, 500) : '', demoUrl: input.demoUrl ? validateString(input.demoUrl, 'demoUrl', 8, 500) : '', createdAt: now() };
      for (const field of ['repositoryUrl', 'demoUrl']) if (submission[field] && !/^https?:\/\//i.test(submission[field])) throw fail(400, `${field} must be an http or https URL`);
      db.submissions.push(submission); assignEligibleJudges(submission, event); await persist(); return send(res, 201, { submission });
    }
  }
  if (parts[0] === 'api' && parts[1] === 'submissions' && parts[2]) {
    const submission = db.submissions.find(s => s.id === parts[2]); if (!submission) throw fail(404, 'Submission not found');
    const team = teamOr404(submission.teamId); const event = eventOr404(team.eventId);
    if (parts[3] === 'scores' && method === 'PUT') {
      allow(user, 'judge');
      if (!canJudge(user, event.id)) throw fail(403, 'You are not assigned to judge this event');
      if (event.status !== 'published') throw fail(409, 'Scoring is only open for published events');
      const rubric = criteriaFor(event.id, submission.trackId);
      const judgingAssignment = db.judgingAssignments.find(a => a.submissionId === submission.id && a.judgeId === user.id);
      if (!judgingAssignment) throw fail(403, 'You are not assigned to judge this submission or track');
      if (judgingAssignment.status === 'completed') throw fail(409, 'This judging assignment is already completed');
      if (!Array.isArray(input.scores) || input.scores.length !== rubric.length) throw fail(400, `Provide one score for each of the ${rubric.length} rubric criteria`);
      const byId = new Map(input.scores.map(s => [s.criterionId, s]));
      const normalized = rubric.map(criterion => {
        const item = byId.get(criterion.id); const score = Number(item?.score);
        if (!Number.isInteger(score) || score < 0 || score > criterion.maxScore) throw fail(400, `Score for ${criterion.name} must be an integer from 0 to ${criterion.maxScore}`);
        return { criterionId: criterion.id, score, feedback: String(item.feedback || '').trim().slice(0, 2000) };
      });
      db.scores = db.scores.filter(s => s.judgingAssignmentId !== judgingAssignment.id);
      for (const item of normalized) db.scores.push({ id: id(), submissionId: submission.id, eventId: event.id, judgeId: user.id, judgingAssignmentId: judgingAssignment.id, ...item, updatedAt: now() });
      judgingAssignment.status = 'completed'; judgingAssignment.startedAt ||= now(); judgingAssignment.completedAt = now();
      await persist(); return send(res, 200, { scores: normalized });
    }
    if (parts[3] === 'scores' && method === 'GET') {
      if (!isEventOrganizer(user, event) && !canJudge(user, event.id)) throw fail(403, 'Only event organizers and assigned judges can view scores');
      return send(res, 200, { rubric: criteriaFor(event.id, submission.trackId), scores: db.scores.filter(s => s.submissionId === submission.id).map(s => ({ ...s, judge: cleanUser(db.users.find(u => u.id === s.judgeId)) })) });
    }
    if (method === 'GET') {
      if (!isEventOrganizer(user, event) && !(user.role === 'judge' && canJudge(user, event.id)) && !isMember(user, team)) throw fail(403, 'You do not have access to this submission');
      return send(res, 200, { submission, team: publicTeam(team) });
    }
  }
  if (parts[0] === 'api' && parts[1] === 'judging-assignments' && parts[2] && method === 'PATCH') {
    const assignment = db.judgingAssignments.find(item => item.id === parts[2]);
    if (!assignment) throw fail(404, 'Judging assignment not found');
    const event = eventOr404(assignment.eventId);
    if (assignment.judgeId !== user.id && !isEventOrganizer(user, event)) throw fail(403, 'Only the assigned judge or event organizer can update this assignment');
    if (!['assigned', 'in_progress', 'completed'].includes(input.status)) throw fail(400, 'status must be assigned, in_progress, or completed');
    if (input.status === 'completed') {
      const submission = db.submissions.find(item => item.id === assignment.submissionId);
      const expected = criteriaFor(event.id, submission?.trackId).length;
      const actual = db.scores.filter(score => score.judgingAssignmentId === assignment.id).length;
      if (!expected || actual !== expected) throw fail(409, 'Score every rubric criterion before completing this assignment');
      assignment.completedAt = now();
    } else assignment.completedAt = null;
    assignment.status = input.status;
    if (input.status === 'in_progress') assignment.startedAt ||= now();
    if (input.status === 'assigned') assignment.startedAt = null;
    if (input.overallFeedback !== undefined) assignment.overallFeedback = validateString(input.overallFeedback, 'overallFeedback', 0, 2000);
    await persist(); return send(res, 200, { assignment });
  }
  throw fail(404, 'Endpoint not found');
}

if (process.env.NODE_ENV === 'production' && (!process.env.DATABASE_URL || !process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error('Production requires DATABASE_URL and a JWT_SECRET of at least 32 characters');
}
await initializeStore();
const server = createServer(async (req, res) => {
  res.setHeader('access-control-allow-origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('access-control-allow-methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('access-control-allow-headers', 'Content-Type,Authorization');
  const execute = async () => {
    const healthCheck = req.method === 'GET' && new URL(req.url, 'http://localhost').pathname === '/api/health';
    try {
      if (!healthCheck && storageKind() === 'postgres') await beginRequest();
      await route(req, res);
      if (!healthCheck && storageKind() === 'postgres') await finishRequest(true);
    } catch (error) {
      if (!healthCheck && storageKind() === 'postgres') await finishRequest(false).catch(() => {});
      if (!res.headersSent) send(res, error.status || 500, { error: error.status ? error.message : 'Internal server error' });
      if (!error.status) console.error(error);
    }
  };
  const healthCheck = req.method === 'GET' && new URL(req.url, 'http://localhost').pathname === '/api/health';
  if (healthCheck) await execute();
  else await runLocalSerial(execute);
});
server.listen(PORT, HOST, () => console.log(`DOGFOOD Judging API listening on http://${HOST}:${PORT}`));
async function shutdown() {
  server.close(async () => { await closeStore(); process.exit(0); });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
