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
const ROLES = ['organizer', 'judge', 'participant', 'admin'];

const fail = (status, message) => Object.assign(new Error(message), { status });
const id = () => randomUUID();
const now = () => new Date().toISOString();
const cleanUser = ({ passwordHash, ...user }) => user;

async function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const derived = await scrypt(password, salt, 64);
  return `${salt}:${derived.toString('hex')}`;
}
async function seedStore() {
  if (db.users.length) return;
  const createdAt = now();
  const demoPassword = process.env.DEMO_PASSWORD || 'HackForge26!';
  const accounts = [
    ['Jordan Lee', 'participant@example.com', 'participant'],
    ['Morgan Chen', 'organizer@example.com', 'organizer'],
    ['Avery Patel', 'judge@example.com', 'judge'],
    ['Sam Rivera', 'judge2@example.com', 'judge'],
    ['Taylor Kim', 'admin@example.com', 'admin'],
  ];
  for (const [name, email, role] of accounts) db.users.push({ id: id(), name, email, role, passwordHash: await hashPassword(demoPassword), createdAt });
  const [participant, organizer, judge, judge2] = db.users;
  const eventId = id();
  const event = {
    id: eventId, slug: 'demo-event', organizerId: organizer.id, title: 'DOGFOOD Hackathon',
    description: 'Three days to turn a good idea into something real. Find your team, make in the open, and show the world what you built.',
    venue: 'Online · Global', status: 'published', registrationStartAt: '2026-09-01T00:00:00.000Z',
    registrationEndAt: '2026-10-08T23:59:00.000Z', startAt: '2026-10-09T00:00:00.000Z',
    submissionDeadline: '2026-10-11T18:00:00.000Z', judgingStartAt: '2026-10-11T18:00:00.000Z',
    endAt: '2026-10-11T23:59:00.000Z', judgingEndAt: '2026-10-12T12:00:00.000Z',
    resultsPublic: false, votingEnabled: true, teamCapacity: 5,
    rules: ['Be kind and build in the open.', 'Submit original work created during the event.', 'Include a working repository or demo link.'],
    prizes: [{ name: 'Grand Prize', value: '$2,500' }, { name: 'Community Choice', value: '$1,000' }],
    rubric: [], createdAt, updatedAt: createdAt,
  };
  db.events.push(event);
  const tracks = [
    ['Open source', 'Tools that make the commons stronger.'],
    ['Community', 'Technology that brings people together.'],
    ['Climate', 'Practical ideas for a more resilient future.'],
  ].map(([name, description]) => ({ id: id(), eventId, name, description, createdAt }));
  db.tracks.push(...tracks);
  const criteria = [['Impact', 10, 30], ['Craft', 10, 25], ['Originality', 10, 25], ['Presentation', 10, 20]]
    .map(([name, maxScore, weight], position) => ({ id: id(), eventId, trackId: null, name, description: `${name} and its contribution to the community.`, maxScore, weight, position }));
  db.criteria.push(...criteria);
  event.rubric = criteria.map(({ id: criterionId, name, description, maxScore, weight }) => ({ id: criterionId, name, description, maxScore, weight }));
  const secondParticipant = { id: id(), name: 'Riley Brooks', email: 'riley@example.com', role: 'participant', passwordHash: await hashPassword(demoPassword), createdAt };
  db.users.push(secondParticipant);
  const teams = [
    { id: id(), eventId, name: 'Pixel Pioneers', memberIds: [participant.id, secondParticipant.id], createdBy: participant.id, createdAt },
    { id: id(), eventId, name: 'Good Neighbors', memberIds: [organizer.id], createdBy: organizer.id, createdAt },
    { id: id(), eventId, name: 'Blue Hour', memberIds: [judge2.id], createdBy: judge2.id, createdAt },
  ];
  db.teams.push(...teams);
  db.registrations.push(...db.users.filter(item => item.role === 'participant').map(item => ({ id: id(), eventId, userId: item.id, createdAt })));
  const demoProjects = [
    ['CivicSignal', 'A better way to be heard locally.', 'Community', teams[0], ['Next.js', 'Open data', 'Civic tech'], 'SUBMITTED'],
    ['OpenShelf', 'Making neighborhood sharing feel effortless.', 'Open source', teams[1], ['TypeScript', 'Mutual aid', 'Maps'], 'SUBMITTED'],
    ['Tidepool', 'Turn shoreline observations into action.', 'Climate', teams[2], ['Python', 'Sensors', 'Open data'], 'SUBMITTED'],
  ];
  for (const [title, tagline, trackName, team, tags, status] of demoProjects) {
    const track = tracks.find(item => item.name === trackName);
    db.submissions.push({ id: id(), teamId: team.id, trackId: track.id, title, tagline, summary: `${tagline} Built by ${team.name} during DOGFOOD Hackathon.`, tags, repositoryUrl: 'https://github.com/example/hackforge-demo', demoUrl: 'https://example.com', status, createdAt, updatedAt: createdAt, submittedAt: createdAt });
  }
  db.assignments.push(...[judge, judge2].map(item => ({ id: id(), eventId, judgeId: item.id, createdAt })));
  for (const submission of db.submissions) {
    const assignment = ensureJudgingAssignment(submission, event, judge.id);
    if (submission.id === db.submissions[0].id) {
      for (const criterion of criteria) db.scores.push({ id: id(), submissionId: submission.id, eventId, judgeId: judge.id, judgingAssignmentId: assignment.id, criterionId: criterion.id, score: 8, feedback: 'A promising, well considered idea.', updatedAt: createdAt });
      assignment.status = 'completed'; assignment.startedAt = createdAt; assignment.completedAt = createdAt;
    }
  }
  const comment = { id: id(), projectId: db.submissions[0].id, userId: judge2.id, body: 'Clear problem framing and a thoughtful community-first direction.', createdAt };
  db.comments.push(comment);
  db.votes.push({ id: id(), projectId: db.submissions[1].id, userId: participant.id, createdAt });
  audit(organizer, 'seed.created', 'event', eventId);
  await persist();
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
function allow(user, ...roles) { if (!roles.includes(user.role) && !(user.role === 'admin' && roles.includes('organizer'))) throw fail(403, 'You do not have permission to perform this action'); }
function eventOr404(eventId) { const event = db.events.find(item => item.id === eventId || (eventId === 'demo-event' && item.slug === 'demo-event')); if (!event) throw fail(404, 'Event not found'); return event; }
function teamOr404(teamId) { const team = db.teams.find(item => item.id === teamId); if (!team) throw fail(404, 'Team not found'); return team; }
function isMember(user, team) { return team.memberIds.includes(user.id); }
function isEventOrganizer(user, event) { return user.role === 'admin' || (user.role === 'organizer' && event.organizerId === user.id); }
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
  const weight = Number(input.weight ?? 1);
  if (!Number.isFinite(weight) || weight <= 0 || weight > 100) throw fail(400, `Weight for ${name} must be greater than 0 and at most 100`);
  return { id: criterionId, eventId, trackId, name, description: String(input.description || '').trim().slice(0, 500), maxScore, weight, position };
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
function audit(user, action, entityType, entityId, details = {}) {
  db.auditLogs.push({ id: id(), userId: user?.id || null, action, entityType, entityId: entityId || null, details, createdAt: now() });
}
function projectView(submission) {
  const team = db.teams.find(item => item.id === submission.teamId);
  const event = team && db.events.find(item => item.id === team.eventId);
  return {
    ...submission,
    status: submission.status || 'SUBMITTED',
    tagline: submission.tagline || submission.summary.slice(0, 120),
    tags: submission.tags || [],
    track: db.tracks.find(item => item.id === submission.trackId)?.name || 'General',
    team: team ? publicTeam(team) : null,
    event: event ? { id: event.id, title: event.title, votingEnabled: Boolean(event.votingEnabled), resultsPublic: Boolean(event.resultsPublic) } : null,
  };
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
    const submissions = db.submissions.filter(s => s.teamId === team.id && s.status === 'SUBMITTED');
    const latest = submissions.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const scores = latest ? db.scores.filter(s => s.submissionId === latest.id) : [];
    const categories = {};
    for (const score of scores) {
      categories[score.criterionId] ||= { total: 0, count: 0 };
      categories[score.criterionId].total += score.score;
      categories[score.criterionId].count++;
    }
    const rubric = criteriaFor(eventId, latest?.trackId || null);
    const judgeIds = [...new Set(scores.map(score => score.judgeId))];
    const judgeTotals = judgeIds.map(judgeId => {
      const byCriterion = new Map(scores.filter(score => score.judgeId === judgeId).map(score => [score.criterionId, score.score]));
      const totalWeight = rubric.reduce((sum, criterion) => sum + Number(criterion.weight || 1), 0);
      return totalWeight ? rubric.reduce((sum, criterion) => sum + (Number(byCriterion.get(criterion.id) || 0) / criterion.maxScore) * Number(criterion.weight || 1), 0) / totalWeight * 100 : 0;
    });
    const score = judgeTotals.length ? Number((judgeTotals.reduce((sum, value) => sum + value, 0) / judgeTotals.length).toFixed(2)) : null;
    const completedJudges = latest ? db.judgingAssignments.filter(assignment => assignment.submissionId === latest.id && assignment.status === 'completed').length : 0;
    return { team: publicTeam(team), submission: latest ? projectView(latest) : null, score, completedJudges, categories: Object.fromEntries(Object.entries(categories).map(([key, value]) => [key, Number((value.total / value.count).toFixed(2))])) };
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

  if (method === 'POST' && (path === '/api/auth/register' || path === '/api/auth/signup')) {
    const name = validateString(input.name, 'name', 2, 100);
    const email = validateEmail(input.email);
    if (typeof input.password !== 'string' || input.password.length < 8 || input.password.length > 128) throw fail(400, 'password must be 8-128 characters');
    const role = input.role || 'participant';
    if (!ROLES.includes(role) || role === 'admin') throw fail(400, 'Public registration is available for participants, judges, and organizers only');
    if (role !== 'participant') {
      const inviteCode = role === 'organizer' ? process.env.ORGANIZER_INVITE_CODE : process.env.JUDGE_INVITE_CODE;
      if (!inviteCode || input.inviteCode !== inviteCode) throw fail(403, `A valid ${role} invite code is required`);
    }
    if (db.users.some(u => u.email === email)) throw fail(409, 'An account with this email already exists');
    const user = { id: id(), name, email, role, passwordHash: await hashPassword(input.password), createdAt: now() };
    db.users.push(user); audit(user, 'auth.signup', 'user', user.id); await persist();
    return send(res, 201, { user: cleanUser(user), token: tokenFor(user) });
  }
  if (method === 'POST' && path === '/api/auth/login') {
    const email = validateEmail(input.email);
    const user = db.users.find(u => u.email === email);
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) throw fail(401, 'Email or password is incorrect');
    audit(user, 'auth.login', 'user', user.id); await persist();
    return send(res, 200, { user: cleanUser(user), token: tokenFor(user) });
  }

  if (method === 'GET' && path === '/api/events') {
    return send(res, 200, { events: db.events.filter(event => event.status === 'published').map(event => ({
      ...event,
      participantCount: db.registrations.filter(row => row.eventId === event.id).length,
      teamCount: db.teams.filter(team => team.eventId === event.id).length,
      projectCount: db.submissions.filter(project => project.status === 'SUBMITTED' && db.teams.some(team => team.id === project.teamId && team.eventId === event.id)).length,
      tracks: db.tracks.filter(track => track.eventId === event.id),
    })) });
  }
  if (method === 'GET' && parts[0] === 'api' && parts[1] === 'events' && parts[2] && parts.length === 3) {
    const event = eventOr404(parts[2]);
    if (event.status === 'published') return send(res, 200, { event: { ...event, participantCount: db.registrations.filter(row => row.eventId === event.id).length, teamCount: db.teams.filter(team => team.eventId === event.id).length, projectCount: db.submissions.filter(project => project.status === 'SUBMITTED' && db.teams.some(team => team.id === project.teamId && team.eventId === event.id)).length, tracks: db.tracks.filter(track => track.eventId === event.id).map(track => ({ ...track, criteria: criteriaFor(event.id, track.id) })) } });
    if (!req.headers.authorization) throw fail(404, 'Event not found');
  }
  if (method === 'GET' && parts[0] === 'api' && parts[1] === 'events' && parts[2] && parts[3] === 'leaderboard') {
    const event = eventOr404(parts[2]);
    if (!event.resultsPublic) throw fail(403, 'Results have not been published');
    return send(res, 200, { leaderboard: leaderboard(event.id).map(item => ({ ...item, prize: event.prizes?.[item.rank - 1] || null })) });
  }
  if (method === 'GET' && (path === '/api/gallery' || path === '/api/projects')) {
    let projects = db.submissions.filter(item => item.status === 'SUBMITTED').map(projectView);
    const query = (url.searchParams.get('q') || '').trim().toLowerCase();
    const track = url.searchParams.get('track');
    if (query) projects = projects.filter(project => [project.title, project.tagline, project.summary, project.team?.name, ...(project.tags || [])].join(' ').toLowerCase().includes(query));
    if (track && track !== 'all') projects = projects.filter(project => project.track === track);
    projects.sort((first, second) => second.createdAt.localeCompare(first.createdAt));
    return send(res, 200, { projects });
  }
  if (method === 'GET' && parts[0] === 'api' && parts[1] === 'projects' && parts[2] && parts.length === 3) {
    const project = db.submissions.find(item => item.id === parts[2]);
    if (project?.status !== 'SUBMITTED') {
      if (!project) throw fail(404, 'Project not found');
    } else {
    const view = projectView(project);
    let hasVoted = false;
    if (req.headers.authorization) {
      try { const currentUser = authenticate(req); hasVoted = db.votes.some(item => item.projectId === project.id && item.userId === currentUser.id); } catch { /* Public project details remain available to signed-out visitors. */ }
    }
    return send(res, 200, { project: view, comments: db.comments.filter(item => item.projectId === project.id).map(item => ({ ...item, author: cleanUser(db.users.find(person => person.id === item.userId)) })), votes: view.event?.votingEnabled && !view.event.resultsPublic ? null : db.votes.filter(item => item.projectId === project.id).length, hasVoted });
    }
  }
  if (method === 'POST' && path === '/api/auth/logout') return send(res, 200, { ok: true });

  const user = authenticate(req);
  if (method === 'GET' && path === '/api/auth/me') return send(res, 200, { user: cleanUser(user) });

  if (method === 'GET' && path === '/api/dashboard') {
    allow(user, 'participant');
    const event = db.events.find(item => item.status === 'published');
    const team = event && db.teams.find(item => item.eventId === event.id && isMember(user, item));
    const project = team && db.submissions.find(item => item.teamId === team.id);
    return send(res, 200, { user: cleanUser(user), event, registered: event ? db.registrations.some(item => item.eventId === event.id && item.userId === user.id) : false, team: team ? publicTeam(team) : null, project: project ? projectView(project) : null });
  }

  if (parts[0] === 'api' && parts[1] === 'invites' && parts[2] && parts[3] === 'accept' && method === 'POST') {
    allow(user, 'participant');
    const invite = db.invites.find(item => item.code === parts[2]);
    if (!invite || new Date(invite.expiresAt).getTime() < Date.now()) throw fail(404, 'Invite is missing or expired');
    const team = teamOr404(invite.teamId); const event = eventOr404(team.eventId);
    if (db.teams.some(item => item.eventId === event.id && item.memberIds.includes(user.id))) throw fail(409, 'You already belong to a team in this event');
    if (team.memberIds.length >= (event.teamCapacity || 5)) throw fail(409, 'This team is already full');
    if (!db.registrations.some(row => row.eventId === event.id && row.userId === user.id)) db.registrations.push({ id: id(), eventId: event.id, userId: user.id, createdAt: now() });
    team.memberIds.push(user.id); db.invites = db.invites.filter(item => item.code !== invite.code);
    audit(user, 'team.invite.accepted', 'team', team.id); await persist();
    return send(res, 200, { team: publicTeam(team) });
  }

  if (method === 'GET' && path === '/api/organizer/dashboard') {
    allow(user, 'organizer');
    const event = db.events.find(item => isEventOrganizer(user, item));
    if (!event) throw fail(404, 'Event not found');
    const teams = db.teams.filter(item => item.eventId === event.id);
    const submissions = db.submissions.filter(item => teams.some(team => team.id === item.teamId));
    const judgingAssignments = db.judgingAssignments.filter(item => item.eventId === event.id);
    return send(res, 200, { event, metrics: {
      participants: db.registrations.filter(item => item.eventId === event.id).length,
      teams: teams.length,
      projects: submissions.length,
      submittedProjects: submissions.filter(item => item.status === 'SUBMITTED').length,
      judges: db.assignments.filter(item => item.eventId === event.id).length,
      assignedReviews: judgingAssignments.length,
      inProgressReviews: judgingAssignments.filter(item => item.status === 'in_progress').length,
      completedReviews: judgingAssignments.filter(item => item.status === 'completed').length,
      judgingProgress: judgingAssignments.length ? Math.round(judgingAssignments.filter(item => item.status === 'completed').length / judgingAssignments.length * 100) : 0,
      votes: db.votes.filter(item => submissions.some(project => project.id === item.projectId)).length,
      deadline: event.submissionDeadline,
    } });
  }
  if (method === 'GET' && path === '/api/judge/assignments') {
    allow(user, 'judge');
    const assignments = db.judgingAssignments.filter(item => item.judgeId === user.id).map(assignment => {
      const project = db.submissions.find(item => item.id === assignment.submissionId);
      return project ? { ...assignment, project: projectView(project) } : null;
    }).filter(Boolean);
    return send(res, 200, { assignments });
  }
  if (method === 'GET' && path === '/api/organizer/judges') {
    allow(user, 'organizer');
    const event = db.events.find(item => isEventOrganizer(user, item));
    if (!event) throw fail(404, 'Event not found');
    const judges = db.assignments.filter(item => item.eventId === event.id).map(item => {
      const judge = db.users.find(candidate => candidate.id === item.judgeId);
      return judge ? { ...cleanUser(judge), status: 'Active', completedReviews: db.judgingAssignments.filter(assignment => assignment.judgeId === judge.id && assignment.eventId === event.id && assignment.status === 'completed').length } : null;
    }).filter(Boolean);
    const assignments = db.judgingAssignments.filter(item => item.eventId === event.id).map(item => {
      const project = db.submissions.find(submission => submission.id === item.submissionId);
      const team = project && db.teams.find(candidate => candidate.id === project.teamId);
      return project && team ? { id: item.id, judgeId: item.judgeId, projectId: project.id, project: project.title, team: team.name, status: item.status } : null;
    }).filter(Boolean);
    const projects = db.submissions.filter(project => project.status === 'SUBMITTED' && db.teams.some(team => team.id === project.teamId && team.eventId === event.id)).map(project => ({ id: project.id, name: project.title, team: db.teams.find(team => team.id === project.teamId)?.name || 'HackForge team' }));
    return send(res, 200, { judges, assignments, projects });
  }
  if (method === 'POST' && path === '/api/judge/assignments') {
    allow(user, 'organizer');
    const event = eventOr404(input.eventId);
    if (!isEventOrganizer(user, event)) throw fail(403, 'Only the event organizer can assign judges');
    const project = db.submissions.find(item => item.id === input.projectId);
    if (!project || project.status !== 'SUBMITTED') throw fail(404, 'Submitted project not found');
    const judgeEmail = validateEmail(input.email);
    let judge = db.users.find(item => item.email === judgeEmail && item.role === 'judge');
    let temporaryPassword;
    if (!judge) {
      temporaryPassword = randomBytes(9).toString('base64url');
      judge = { id: id(), name: validateString(input.name || judgeEmail.split('@')[0], 'judge name', 2, 100), email: judgeEmail, role: 'judge', passwordHash: await hashPassword(temporaryPassword), createdAt: now() };
      db.users.push(judge);
    }
    if (!db.assignments.some(item => item.eventId === event.id && item.judgeId === judge.id)) db.assignments.push({ id: id(), eventId: event.id, judgeId: judge.id, createdAt: now() });
    const assignment = ensureJudgingAssignment(project, event, judge.id);
    audit(user, 'judge.assignment.created', 'project', project.id, { judgeId: judge.id }); await persist();
    return send(res, 201, { assignment, judge: cleanUser(judge), ...(temporaryPassword ? { temporaryPassword } : {}) });
  }
  if (method === 'DELETE' && parts[0] === 'api' && parts[1] === 'judge' && parts[2] === 'assignments' && parts[3]) {
    allow(user, 'organizer');
    const assignment = db.judgingAssignments.find(item => item.id === parts[3]);
    if (!assignment) throw fail(404, 'Judge assignment not found');
    const event = eventOr404(assignment.eventId);
    if (!isEventOrganizer(user, event)) throw fail(403, 'Only the event organizer can remove this assignment');
    db.judgingAssignments = db.judgingAssignments.filter(item => item.id !== assignment.id);
    db.scores = db.scores.filter(score => score.judgingAssignmentId !== assignment.id);
    audit(user, 'judge.assignment.removed', 'project', assignment.submissionId, { judgeId: assignment.judgeId }); await persist();
    return send(res, 200, { removed: true });
  }
  if (method === 'GET' && parts[0] === 'api' && parts[1] === 'judge' && parts[2] === 'projects' && parts[3]) {
    allow(user, 'judge');
    const project = db.submissions.find(item => item.id === parts[3]);
    if (!project || project.status !== 'SUBMITTED') throw fail(404, 'Project not found');
    const assignment = db.judgingAssignments.find(item => item.submissionId === project.id && item.judgeId === user.id);
    if (!assignment) throw fail(403, 'This project is not assigned to you');
    const team = teamOr404(project.teamId); const event = eventOr404(team.eventId);
    return send(res, 200, { project: projectView(project), assignment, rubric: criteriaFor(event.id, project.trackId), scores: db.scores.filter(item => item.judgingAssignmentId === assignment.id) });
  }
  if (method === 'GET' && path === '/api/organizer/results') {
    allow(user, 'organizer');
    const eventId = url.searchParams.get('eventId'); const event = eventId ? eventOr404(eventId) : db.events.find(item => isEventOrganizer(user, item));
    if (!event || !isEventOrganizer(user, event)) throw fail(404, 'Event not found');
    return send(res, 200, { event: { id: event.id, title: event.title, resultsPublic: Boolean(event.resultsPublic) }, results: leaderboard(event.id).map(item => ({ ...item, prize: event.prizes?.[item.rank - 1] || null })) });
  }
  if (method === 'POST' && path === '/api/organizer/results') {
    allow(user, 'organizer'); const event = eventOr404(input.eventId);
    if (!isEventOrganizer(user, event)) throw fail(403, 'Only the event organizer can publish results');
    event.resultsPublic = input.public !== false; event.updatedAt = now();
    audit(user, 'results.published', 'event', event.id, { public: event.resultsPublic }); await persist();
    return send(res, 200, { resultsPublic: event.resultsPublic });
  }
  if (method === 'POST' && parts[0] === 'api' && parts[1] === 'judge' && parts[2] === 'scores' && parts[3] && parts[4] === 'submit') {
    allow(user, 'judge');
    const score = db.scores.find(item => item.id === parts[3]);
    if (!score || score.judgeId !== user.id) throw fail(404, 'Score not found');
    const assignment = db.judgingAssignments.find(item => item.id === score.judgingAssignmentId);
    if (!assignment || assignment.judgeId !== user.id) throw fail(403, 'You cannot submit another judge’s score');
    const project = db.submissions.find(item => item.id === assignment.submissionId);
    const expected = criteriaFor(assignment.eventId, project?.trackId).length;
    const actual = db.scores.filter(item => item.judgingAssignmentId === assignment.id).length;
    if (!expected || expected !== actual) throw fail(409, 'Score every rubric criterion before submitting the final review');
    assignment.status = 'completed'; assignment.startedAt ||= now(); assignment.completedAt = now();
    audit(user, 'score.submitted', 'project', assignment.submissionId); await persist();
    return send(res, 200, { assignment });
  }
  if (method === 'POST' && path === '/api/judge/scores') {
    if (!input.projectId) throw fail(400, 'projectId is required');
    parts.splice(0, parts.length, 'api', 'submissions', String(input.projectId), 'scores');
  }

  if (parts[0] === 'api' && parts[1] === 'events' && parts.length === 2) {
    if (method === 'POST') {
      allow(user, 'organizer');
      const title = validateString(input.title, 'title', 3, 120);
      const startAt = parseDate(input.startAt, 'startAt');
      const endAt = parseDate(input.endAt, 'endAt');
      if (new Date(endAt) <= new Date(startAt)) throw fail(400, 'endAt must be after startAt');
      const event = { id: id(), organizerId: user.id, title, description: String(input.description || '').trim().slice(0, 5000), venue: String(input.venue || '').trim().slice(0, 200), startAt, endAt, status: 'draft', rubric: [], createdAt: now(), updatedAt: now() };
      event.slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      event.registrationStartAt = input.registrationStartAt ? parseDate(input.registrationStartAt, 'registrationStartAt') : now();
      event.registrationEndAt = input.registrationEndAt ? parseDate(input.registrationEndAt, 'registrationEndAt') : startAt;
      event.submissionDeadline = input.submissionDeadline ? parseDate(input.submissionDeadline, 'submissionDeadline') : endAt;
      event.prizes = Array.isArray(input.prizes) ? input.prizes : [];
      event.rules = Array.isArray(input.rules) ? input.rules : [];
      event.votingEnabled = Boolean(input.votingEnabled);
      event.resultsPublic = false;
      event.teamCapacity = Number(input.teamCapacity) || 5;
      db.events.push(event); audit(user, 'event.created', 'event', event.id); await persist(); return send(res, 201, { event });
    }
    if (method === 'GET') {
      const visible = db.events.filter(e => isEventOrganizer(user, e) || canJudge(user, e.id) || db.teams.some(t => t.eventId === e.id && isMember(user, t)));
      return send(res, 200, { events: visible });
    }
  }
  if (parts[0] === 'api' && parts[1] === 'events' && parts[2]) {
    const event = eventOr404(parts[2]);
    const eventId = event.id;
    const owns = isEventOrganizer(user, event);
    if (parts.length === 4 && parts[3] === 'register' && method === 'GET') {
      allow(user, 'participant');
      return send(res, 200, { registered: db.registrations.some(row => row.eventId === eventId && row.userId === user.id) });
    }
    if (parts.length === 4 && parts[3] === 'register' && method === 'POST') {
      allow(user, 'participant');
      const time = Date.now();
      if (time < new Date(event.registrationStartAt || event.createdAt).getTime() || time > new Date(event.registrationEndAt || event.startAt).getTime()) throw fail(409, 'Event registration is closed');
      if (db.registrations.some(row => row.eventId === eventId && row.userId === user.id)) throw fail(409, 'You are already registered for this event');
      const registration = { id: id(), eventId, userId: user.id, createdAt: now() };
      db.registrations.push(registration); audit(user, 'event.register', 'event', eventId); await persist();
      return send(res, 201, { registration });
    }
    if (parts.length === 3 && method === 'GET') { eventAccess(user, eventId); return send(res, 200, { event }); }
    if (parts.length === 3 && method === 'PATCH') {
      allow(user, 'organizer'); if (!owns) throw fail(403, 'Only the event organizer can update this event');
      if (event.status === 'completed') throw fail(409, 'Completed events cannot be changed');
      for (const field of ['title', 'description', 'venue']) if (input[field] !== undefined) event[field] = field === 'title' ? validateString(input[field], field, 3, 120) : String(input[field]).trim().slice(0, 5000);
      if (input.startAt !== undefined) event.startAt = parseDate(input.startAt, 'startAt');
      if (input.endAt !== undefined) event.endAt = parseDate(input.endAt, 'endAt');
      for (const field of ['registrationStartAt', 'registrationEndAt', 'submissionDeadline', 'judgingStartAt', 'judgingEndAt']) if (input[field] !== undefined) event[field] = parseDate(input[field], field);
      for (const field of ['rules', 'prizes']) if (input[field] !== undefined) { if (!Array.isArray(input[field])) throw fail(400, `${field} must be a list`); event[field] = input[field].slice(0, 30); }
      if (input.tracks !== undefined) {
        if (!Array.isArray(input.tracks) || input.tracks.length > 12) throw fail(400, 'tracks must be a list of at most 12 items');
        const nextTracks = input.tracks.map(trackInput => ({ id: trackInput.id || id(), eventId, name: validateString(trackInput.name, 'track name', 2, 100), description: String(trackInput.description || '').trim().slice(0, 1000), createdAt: now() }));
        if (new Set(nextTracks.map(track => track.name.toLowerCase())).size !== nextTracks.length) throw fail(409, 'Track names must be unique');
        const nextTrackIds = new Set(nextTracks.map(track => track.id));
        if (db.submissions.some(submission => submission.trackId && !nextTrackIds.has(submission.trackId) && teamOr404(submission.teamId).eventId === eventId)) throw fail(409, 'A track with submitted projects cannot be removed');
        db.tracks = db.tracks.filter(track => track.eventId !== eventId).concat(nextTracks);
      }
      for (const field of ['votingEnabled', 'resultsPublic']) if (input[field] !== undefined) { if (typeof input[field] !== 'boolean') throw fail(400, `${field} must be boolean`); event[field] = input[field]; }
      if (new Date(event.endAt) <= new Date(event.startAt)) throw fail(400, 'endAt must be after startAt');
      event.updatedAt = now(); audit(user, 'event.updated', 'event', eventId); await persist(); return send(res, 200, { event });
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
      for (const submission of db.submissions.filter(s => s.trackId === track.id && teamOr404(s.teamId).eventId === eventId)) ensureJudgingAssignment(submission, event, judge.id);
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
      event.rubric = rubric.map(({ id: criterionId, name, description, maxScore, weight }) => ({ id: criterionId, name, description, maxScore, weight }));
      event.updatedAt = now(); await persist(); return send(res, 200, { rubric: event.rubric });
    }
    if (parts[3] === 'judges' && method === 'POST') {
      allow(user, 'organizer'); if (!owns) throw fail(403, 'Only the event organizer can assign judges');
      const judge = db.users.find(u => u.email === validateEmail(input.email));
      if (!judge || judge.role !== 'judge') throw fail(404, 'Judge account not found');
      if (!db.assignments.some(a => a.eventId === eventId && a.judgeId === judge.id)) db.assignments.push({ id: id(), eventId, judgeId: judge.id, createdAt: now() });
      for (const submission of db.submissions.filter(s => teamOr404(s.teamId).eventId === eventId && (s.trackId === null || judgeEligible(judge.id, eventId, s.trackId)))) ensureJudgingAssignment(submission, event, judge.id);
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
      event.status = 'published'; event.updatedAt = now(); audit(user, 'event.published', 'event', event.id); await persist(); return send(res, 200, { event });
    }
    if (parts[3] === 'complete' && method === 'POST') {
      allow(user, 'organizer'); if (!owns) throw fail(403, 'Only the event organizer can complete this event');
      if (event.status !== 'published') throw fail(409, 'Only published events can be completed');
      event.status = 'completed'; event.updatedAt = now(); audit(user, 'event.completed', 'event', event.id); await persist(); return send(res, 200, { event });
    }
    if (parts[3] === 'results' && parts[4] === 'publish' && method === 'POST') {
      allow(user, 'organizer'); if (!owns) throw fail(403, 'Only the event organizer can publish results');
      event.resultsPublic = input.public !== false; event.updatedAt = now(); audit(user, 'results.published', 'event', event.id, { public: event.resultsPublic }); await persist();
      return send(res, 200, { resultsPublic: event.resultsPublic });
    }
    if (parts[3] === 'teams' && method === 'GET') { eventAccess(user, eventId); return send(res, 200, { teams: db.teams.filter(t => t.eventId === eventId).map(publicTeam) }); }
    if (parts[3] === 'leaderboard' && method === 'GET') {
      if (!owns && user.role !== 'judge' && !event.resultsPublic) throw fail(403, 'Results have not been published');
      if (user.role === 'judge' && !canJudge(user, eventId)) throw fail(403, 'You are not assigned to this event');
      return send(res, 200, { leaderboard: leaderboard(eventId).map(item => ({ ...item, prize: event.prizes?.[item.rank - 1] || null })) });
    }
    if (parts[3] === 'submissions' && method === 'GET') {
      if (!owns && user.role !== 'judge') throw fail(403, 'Only organizers and judges can view all submissions');
      if (user.role === 'judge' && !canJudge(user, eventId)) throw fail(403, 'You are not assigned to this event');
      return send(res, 200, { submissions: db.submissions.filter(s => teamOr404(s.teamId).eventId === eventId && (owns || db.judgingAssignments.some(a => a.submissionId === s.id && a.judgeId === user.id))) });
    }
  }

  if (parts[0] === 'api' && parts[1] === 'teams') {
    if (parts.length === 2 && method === 'GET') {
      const requestedEventId = url.searchParams.get('eventId');
      const eventId = requestedEventId ? eventOr404(requestedEventId).id : null;
      return send(res, 200, { teams: db.teams.filter(team => (!eventId || team.eventId === eventId) && (isMember(user, team) || isEventOrganizer(user, eventOr404(team.eventId)))).map(publicTeam) });
    }
    if (parts.length === 2 && method === 'POST') {
      allow(user, 'participant');
      const event = eventOr404(input.eventId);
      if (event.status !== 'published') throw fail(409, 'Teams can only be created for published events');
      if (!db.registrations.some(row => row.eventId === event.id && row.userId === user.id)) throw fail(403, 'Register for this event before creating a team');
      if (db.teams.some(t => t.eventId === event.id && t.memberIds.includes(user.id))) throw fail(409, 'You already belong to a team in this event');
      const team = { id: id(), eventId: event.id, name: validateString(input.name, 'name', 2, 80), memberIds: [user.id], createdBy: user.id, createdAt: now() };
      db.teams.push(team); audit(user, 'team.created', 'team', team.id); await persist(); return send(res, 201, { team: publicTeam(team) });
    }
    if (parts[2] && parts.length === 3 && method === 'GET') {
      const team = teamOr404(parts[2]);
      if (!isMember(user, team) && !isEventOrganizer(user, eventOr404(team.eventId))) throw fail(403, 'You do not have access to this team');
      return send(res, 200, { team: publicTeam(team) });
    }
    if (parts[2] && parts[3] === 'invite' && method === 'POST') {
      allow(user, 'participant'); const team = teamOr404(parts[2]);
      if (!isMember(user, team) || team.createdBy !== user.id) throw fail(403, 'Only the team leader can invite members');
      if (team.memberIds.length >= (eventOr404(team.eventId).teamCapacity || 5)) throw fail(409, 'This team is already full');
      const invite = { id: id(), code: randomBytes(8).toString('hex'), teamId: team.id, createdBy: user.id, expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(), createdAt: now() };
      db.invites.push(invite); audit(user, 'team.invite.created', 'team', team.id); await persist();
      return send(res, 201, { invite: { code: invite.code, expiresAt: invite.expiresAt, url: `/teams/demo-team?invite=${invite.code}` } });
    }
    if (parts[2] && parts[3] === 'leave' && method === 'POST') {
      allow(user, 'participant'); const team = teamOr404(parts[2]);
      if (!isMember(user, team)) throw fail(409, 'You are not a member of this team');
      if (team.createdBy === user.id) throw fail(409, 'The team leader must transfer leadership before leaving');
      team.memberIds = team.memberIds.filter(memberId => memberId !== user.id); audit(user, 'team.left', 'team', team.id); await persist();
      return send(res, 200, { team: publicTeam(team) });
    }
    if (parts[2] && parts[3] === 'join' && method === 'POST') {
      allow(user, 'participant'); const team = teamOr404(parts[2]); const event = eventOr404(team.eventId);
      if (event.status !== 'published') throw fail(409, 'You can only join a team in a published event');
      if (!db.registrations.some(row => row.eventId === event.id && row.userId === user.id)) throw fail(403, 'Register for this event before joining a team');
      if (team.memberIds.length >= (event.teamCapacity || 5)) throw fail(409, 'This team is already full');
      if (db.teams.some(t => t.eventId === event.id && t.memberIds.includes(user.id))) throw fail(409, 'You already belong to a team in this event');
      team.memberIds.push(user.id); audit(user, 'team.joined', 'team', team.id); await persist(); return send(res, 200, { team: publicTeam(team) });
    }
    if (parts[2] && parts[3] === 'submissions' && method === 'POST') {
      allow(user, 'participant'); const team = teamOr404(parts[2]); const event = eventOr404(team.eventId);
      if (!isMember(user, team)) throw fail(403, 'Only team members can submit a project');
      if (event.status !== 'published') throw fail(409, 'Submissions are only open for published events');
      const trackId = input.trackId || null;
      if (trackId && !db.tracks.some(track => track.id === trackId && track.eventId === event.id)) throw fail(400, 'trackId must identify a track in this event');
      if (!criteriaFor(event.id, trackId).length) throw fail(409, 'This submission has no scoring rubric; choose a track with criteria');
      if (Date.now() > new Date(event.submissionDeadline || event.endAt).getTime()) throw fail(409, 'The submission deadline has passed');
      if (db.submissions.some(item => item.teamId === team.id)) throw fail(409, 'This team already has a project');
      const submission = { id: id(), teamId: team.id, trackId, title: validateString(input.title, 'title', 2, 150), tagline: String(input.tagline || '').trim(), summary: validateString(input.summary, 'summary', 5, 2000), tags: Array.isArray(input.tags) ? input.tags.slice(0, 12) : [], repositoryUrl: input.repositoryUrl ? validateString(input.repositoryUrl, 'repositoryUrl', 8, 500) : '', demoUrl: input.demoUrl ? validateString(input.demoUrl, 'demoUrl', 8, 500) : '', status: 'SUBMITTED', createdAt: now(), updatedAt: now(), submittedAt: now() };
      for (const field of ['repositoryUrl', 'demoUrl']) if (submission[field] && !/^https?:\/\//i.test(submission[field])) throw fail(400, `${field} must be an http or https URL`);
      db.submissions.push(submission); assignEligibleJudges(submission, event); audit(user, 'project.submitted', 'project', submission.id); await persist(); return send(res, 201, { submission });
    }
  }
  if (parts[0] === 'api' && parts[1] === 'projects') {
    if (parts.length === 2 && method === 'POST') {
      allow(user, 'participant');
      const requestedEvent = input.eventId ? eventOr404(input.eventId) : null;
      const team = input.teamId ? teamOr404(input.teamId) : db.teams.find(item => item.eventId === requestedEvent?.id && isMember(user, item));
      if (!team || !isMember(user, team)) throw fail(403, 'Join or create a team before creating a project');
      const event = eventOr404(team.eventId);
      if (event.status !== 'published') throw fail(409, 'Projects can only be created for a published event');
      if (Date.now() > new Date(event.submissionDeadline || event.endAt).getTime()) throw fail(409, 'The submission deadline has passed');
      if (db.submissions.some(item => item.teamId === team.id)) throw fail(409, 'This team already has a project');
      const trackId = input.trackId || null;
      if (trackId && !db.tracks.some(track => track.id === trackId && track.eventId === event.id)) throw fail(400, 'Choose a track from this event');
      const project = { id: id(), teamId: team.id, trackId, title: validateString(input.title, 'project name', 2, 150), tagline: String(input.tagline || '').trim().slice(0, 180), summary: String(input.summary || input.description || '').trim().slice(0, 2000), tags: Array.isArray(input.tags) ? input.tags.filter(tag => typeof tag === 'string').map(tag => tag.trim().slice(0, 40)).slice(0, 12) : [], repositoryUrl: input.repositoryUrl ? validateString(input.repositoryUrl, 'repositoryUrl', 8, 500) : '', demoUrl: input.demoUrl ? validateString(input.demoUrl, 'demoUrl', 8, 500) : '', status: 'DRAFT', createdAt: now(), updatedAt: now(), submittedAt: null };
      for (const field of ['repositoryUrl', 'demoUrl']) if (project[field] && !/^https?:\/\//i.test(project[field])) throw fail(400, `${field} must be an http or https URL`);
      db.submissions.push(project); audit(user, 'project.created', 'project', project.id); await persist();
      return send(res, 201, { project: projectView(project) });
    }
    if (parts[2] && parts.length === 3 && ['GET', 'PATCH', 'PUT'].includes(method)) {
      const project = db.submissions.find(item => item.id === parts[2]);
      if (!project) throw fail(404, 'Project not found');
      const team = teamOr404(project.teamId); const event = eventOr404(team.eventId);
      if (!isMember(user, team) && !isEventOrganizer(user, event)) throw fail(403, 'You do not have access to this project');
      if (method === 'GET') return send(res, 200, { project: projectView(project) });
      if (user.role !== 'participant' && !isEventOrganizer(user, event)) throw fail(403, 'Only the team or event organizer can edit this project');
      if (!isEventOrganizer(user, event) && Date.now() > new Date(event.submissionDeadline || event.endAt).getTime()) throw fail(409, 'The submission deadline has passed');
      if (project.status === 'SUBMITTED' && Date.now() > new Date(event.submissionDeadline || event.endAt).getTime()) throw fail(409, 'Submitted projects are locked after the deadline');
      if (input.title !== undefined) project.title = validateString(input.title, 'title', 2, 150);
      if (input.tagline !== undefined) project.tagline = String(input.tagline).trim().slice(0, 180);
      if (input.summary !== undefined) project.summary = String(input.summary).trim().slice(0, 2000);
      for (const field of ['repositoryUrl', 'demoUrl']) if (input[field] !== undefined) project[field] = input[field] ? validateString(input[field], field, 8, 500) : '';
      if (input.trackId !== undefined) {
        if (input.trackId && !db.tracks.some(track => track.id === input.trackId && track.eventId === event.id)) throw fail(400, 'Choose a track from this event');
        project.trackId = input.trackId || null;
      }
      if (input.tags !== undefined) {
        if (!Array.isArray(input.tags) || input.tags.length > 12) throw fail(400, 'Tags must be a list of up to 12 items');
        project.tags = input.tags.map(tag => validateString(tag, 'tag', 1, 40));
      }
      project.updatedAt = now(); audit(user, 'project.updated', 'project', project.id); await persist();
      return send(res, 200, { project: projectView(project) });
    }
    if (parts[2] && parts[3] === 'submit' && method === 'POST') {
      allow(user, 'participant'); const project = db.submissions.find(item => item.id === parts[2]);
      if (!project) throw fail(404, 'Project not found');
      const team = teamOr404(project.teamId); const event = eventOr404(team.eventId);
      if (!isMember(user, team)) throw fail(403, 'Only team members can submit this project');
      if (Date.now() > new Date(event.submissionDeadline || event.endAt).getTime()) throw fail(409, 'The submission deadline has passed');
      if (!project.title || !project.tagline || !project.summary || !project.trackId) throw fail(400, 'Add a project name, tagline, description, and track before submitting');
      project.status = 'SUBMITTED'; project.submittedAt = now(); project.updatedAt = now();
      assignEligibleJudges(project, event); audit(user, 'project.submitted', 'project', project.id); await persist();
      return send(res, 200, { project: projectView(project) });
    }
    if (parts[2] && parts[3] === 'vote' && method === 'POST') {
      allow(user, 'participant'); const project = db.submissions.find(item => item.id === parts[2]);
      if (!project || project.status !== 'SUBMITTED') throw fail(404, 'Project not found');
      const team = teamOr404(project.teamId); const event = eventOr404(team.eventId);
      if (!event.votingEnabled || Date.now() > new Date(event.submissionDeadline || event.endAt).getTime()) throw fail(409, 'Community voting is closed');
      if (!db.registrations.some(row => row.eventId === event.id && row.userId === user.id)) throw fail(403, 'Register for this event before voting');
      if (isMember(user, team)) throw fail(403, 'Team members cannot vote for their own project');
      if (db.votes.some(vote => vote.projectId === project.id && vote.userId === user.id)) throw fail(409, 'You have already voted for this project');
      const recentVotes = db.votes.filter(vote => vote.userId === user.id && Date.now() - new Date(vote.createdAt).getTime() < 60_000);
      if (recentVotes.length >= 10) throw fail(429, 'Voting rate limit reached. Please try again shortly.');
      const vote = { id: id(), projectId: project.id, userId: user.id, createdAt: now() };
      db.votes.push(vote); audit(user, 'vote.created', 'project', project.id); await persist();
      return send(res, 201, { vote, count: event.resultsPublic ? db.votes.filter(item => item.projectId === project.id).length : null });
    }
    if (parts[2] && parts[3] === 'comments' && method === 'GET') {
      const project = db.submissions.find(item => item.id === parts[2]);
      if (!project || project.status !== 'SUBMITTED') throw fail(404, 'Project not found');
      return send(res, 200, { comments: db.comments.filter(item => item.projectId === project.id).map(item => ({ ...item, author: cleanUser(db.users.find(person => person.id === item.userId)) })) });
    }
    if (parts[2] && parts[3] === 'comments' && method === 'POST') {
      const project = db.submissions.find(item => item.id === parts[2]);
      if (!project || project.status !== 'SUBMITTED') throw fail(404, 'Project not found');
      const comment = { id: id(), projectId: project.id, userId: user.id, body: validateString(input.body, 'comment', 2, 1000), createdAt: now() };
      db.comments.push(comment); audit(user, 'comment.created', 'project', project.id); await persist();
      return send(res, 201, { comment: { ...comment, author: cleanUser(user) } });
    }
  }

  if (parts[0] === 'api' && parts[1] === 'submissions' && parts[2]) {
    const submission = db.submissions.find(s => s.id === parts[2]); if (!submission) throw fail(404, 'Submission not found');
    const team = teamOr404(submission.teamId); const event = eventOr404(team.eventId);
    if (parts[3] === 'scores' && (method === 'PUT' || method === 'POST')) {
      allow(user, 'judge');
      if (!canJudge(user, event.id)) throw fail(403, 'You are not assigned to judge this event');
      if (event.status !== 'published') throw fail(409, 'Scoring is only open for published events');
      const rubric = criteriaFor(event.id, submission.trackId);
      const judgingAssignment = db.judgingAssignments.find(a => a.submissionId === submission.id && a.judgeId === user.id);
      if (!judgingAssignment) throw fail(403, 'You are not assigned to judge this submission or track');
      if (judgingAssignment.status === 'completed') throw fail(409, 'This judging assignment is already completed');
      if (!Array.isArray(input.scores) || input.scores.length > rubric.length) throw fail(400, `Provide scores for up to ${rubric.length} rubric criteria`);
      const final = input.final === true;
      const byId = new Map(input.scores.map(s => [s.criterionId, s]));
      const normalized = rubric.flatMap(criterion => {
        const item = byId.get(criterion.id);
        if (!item || item.score === '' || item.score === null || item.score === undefined) return [];
        const score = Number(item.score);
        if (!Number.isInteger(score) || score < 0 || score > criterion.maxScore) throw fail(400, `Score for ${criterion.name} must be an integer from 0 to ${criterion.maxScore}`);
        return { criterionId: criterion.id, score, feedback: String(item.feedback || '').trim().slice(0, 2000) };
      });
      if (final && normalized.length !== rubric.length) throw fail(400, `Provide one score for each of the ${rubric.length} rubric criteria before submitting`);
      for (const item of normalized) {
        const existing = db.scores.find(score => score.judgingAssignmentId === judgingAssignment.id && score.criterionId === item.criterionId);
        if (existing) Object.assign(existing, item, { updatedAt: now() });
        else db.scores.push({ id: id(), submissionId: submission.id, eventId: event.id, judgeId: user.id, judgingAssignmentId: judgingAssignment.id, ...item, updatedAt: now() });
      }
      judgingAssignment.status = final ? 'completed' : 'in_progress'; judgingAssignment.startedAt ||= now(); judgingAssignment.completedAt = final ? now() : null;
      audit(user, final ? 'score.submitted' : 'score.draft.saved', 'project', submission.id); await persist();
      return send(res, 200, { scores: normalized, assignment: judgingAssignment });
    }
    if (parts[3] === 'scores' && method === 'GET') {
      if (!isEventOrganizer(user, event) && !db.judgingAssignments.some(a => a.submissionId === submission.id && a.judgeId === user.id)) throw fail(403, 'Only the event organizer and assigned judge can view scores');
      return send(res, 200, { rubric: criteriaFor(event.id, submission.trackId), scores: db.scores.filter(s => s.submissionId === submission.id).map(s => ({ ...s, judge: cleanUser(db.users.find(u => u.id === s.judgeId)) })) });
    }
    if (method === 'GET') {
      if (!isEventOrganizer(user, event) && !(user.role === 'judge' && db.judgingAssignments.some(a => a.submissionId === submission.id && a.judgeId === user.id)) && !isMember(user, team)) throw fail(403, 'You do not have access to this submission');
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

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error('Production requires a JWT_SECRET of at least 32 characters');
}
await initializeStore();
await seedStore();
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
