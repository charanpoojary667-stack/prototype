import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;
const tables = ['users', 'events', 'tracks', 'criteria', 'teams', 'submissions', 'assignments', 'judgeTrackEligibility', 'judgingAssignments', 'scores'];
const db = Object.fromEntries(tables.map(table => [table, []]));
const dataFile = resolve(process.env.DATA_FILE || './data/db.json');
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSL === 'disable' ? false : (process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined), max: Number(process.env.PGPOOL_MAX || 10), idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000 }) : null;
let activeClient;
let localQueue = Promise.resolve();

export async function initializeStore() {
  if (pool) {
    const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
    const client = await pool.connect();
    try { await client.query('BEGIN'); await client.query(schema); await client.query('COMMIT'); }
    catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
    finally { client.release(); }
    console.log('Storage: PostgreSQL');
  } else {
    try {
      const saved = JSON.parse(await readFile(dataFile, 'utf8'));
      for (const table of tables) db[table] = Array.isArray(saved[table]) ? saved[table] : [];
      db.tracks ||= []; db.criteria ||= []; db.judgeTrackEligibility ||= []; db.judgingAssignments ||= [];
      for (const event of db.events) {
        event.rubric ||= [];
        if (!db.criteria.some(c => c.eventId === event.id && !c.trackId)) {
          event.rubric.forEach((criterion, position) => db.criteria.push({ id: criterion.id, eventId: event.id, trackId: null, name: criterion.name, description: criterion.description || '', maxScore: criterion.maxScore || 10, position }));
        }
      }
      for (const submission of db.submissions) submission.trackId ||= null;
      for (const score of db.scores) {
        let assignment = db.judgingAssignments.find(a => a.submissionId === score.submissionId && a.judgeId === score.judgeId);
        if (!assignment) {
          assignment = { id: randomUUID(), eventId: score.eventId, submissionId: score.submissionId, judgeId: score.judgeId, status: 'in_progress', overallFeedback: '', assignedAt: score.updatedAt, startedAt: score.updatedAt, completedAt: null };
          db.judgingAssignments.push(assignment);
        }
        score.judgingAssignmentId ||= assignment.id;
      }
      for (const submission of db.submissions) {
        const team = db.teams.find(item => item.id === submission.teamId);
        const eventId = team?.eventId;
        for (const eventJudge of db.assignments.filter(item => item.eventId === eventId)) {
          const eligible = db.judgeTrackEligibility.filter(item => item.trackId === submission.trackId);
          if (eligible.length && !eligible.some(item => item.judgeId === eventJudge.judgeId)) continue;
          if (!db.judgingAssignments.some(item => item.submissionId === submission.id && item.judgeId === eventJudge.judgeId)) db.judgingAssignments.push({ id: randomUUID(), eventId, submissionId: submission.id, judgeId: eventJudge.judgeId, status: 'assigned', overallFeedback: '', assignedAt: new Date().toISOString(), startedAt: null, completedAt: null });
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await persistJson();
    }
    console.log(`Storage: local JSON (${dataFile})`);
  }
}

async function loadPostgres(client) {
  const [users, events, tracks, criteria, teams, members, submissions, assignments, eligibility, judgingAssignments, scores] = await Promise.all([
    client.query('SELECT * FROM users'), client.query('SELECT * FROM events'), client.query('SELECT * FROM tracks'),
    client.query('SELECT * FROM rubric_criteria ORDER BY position'), client.query('SELECT * FROM teams'),
    client.query('SELECT team_id, user_id, position FROM team_members ORDER BY position'),
    client.query('SELECT * FROM submissions'), client.query('SELECT * FROM judge_assignments'),
    client.query('SELECT * FROM judge_track_eligibility'), client.query('SELECT * FROM judging_assignments'), client.query('SELECT * FROM scores'),
  ]);
  const memberMap = new Map();
  for (const row of members.rows) { const list = memberMap.get(row.team_id) || []; list[row.position] = row.user_id; memberMap.set(row.team_id, list); }
  db.users = users.rows.map(row => ({ id: row.id, name: row.name, email: row.email, role: row.role, passwordHash: row.password_hash, createdAt: row.created_at.toISOString() }));
  db.criteria = criteria.rows.map(row => ({ id: row.id, eventId: row.event_id, trackId: row.track_id, name: row.name, description: row.description, maxScore: row.max_score, position: row.position }));
  db.events = events.rows.map(row => ({ id: row.id, organizerId: row.organizer_id, title: row.title, description: row.description, venue: row.venue, startAt: row.start_at.toISOString(), endAt: row.end_at.toISOString(), status: row.status, rubric: db.criteria.filter(c => c.eventId === row.id && !c.trackId).sort((a,b) => a.position-b.position).map(({id,name,description,maxScore}) => ({id,name,description,maxScore})), createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() }));
  db.tracks = tracks.rows.map(row => ({ id: row.id, eventId: row.event_id, name: row.name, description: row.description, createdAt: row.created_at.toISOString() }));
  db.judgeTrackEligibility = eligibility.rows.map(row => ({ id: row.id, eventId: row.event_id, trackId: row.track_id, judgeId: row.judge_id, createdAt: row.created_at.toISOString() }));
  db.judgingAssignments = judgingAssignments.rows.map(row => ({ id: row.id, eventId: row.event_id, submissionId: row.submission_id, judgeId: row.judge_id, status: row.status, overallFeedback: row.overall_feedback, assignedAt: row.assigned_at.toISOString(), startedAt: row.started_at?.toISOString() || null, completedAt: row.completed_at?.toISOString() || null }));
  db.teams = teams.rows.map(row => ({ id: row.id, eventId: row.event_id, name: row.name, memberIds: memberMap.get(row.id) || [], createdBy: row.created_by, createdAt: row.created_at.toISOString() }));
  db.submissions = submissions.rows.map(row => ({ id: row.id, teamId: row.team_id, trackId: row.track_id, title: row.title, summary: row.summary, repositoryUrl: row.repository_url, demoUrl: row.demo_url, createdAt: row.created_at.toISOString() }));
  db.assignments = assignments.rows.map(row => ({ id: row.id, eventId: row.event_id, judgeId: row.judge_id, createdAt: row.created_at.toISOString() }));
  db.scores = scores.rows.map(row => ({ id: row.id, submissionId: row.submission_id, eventId: row.event_id, judgeId: row.judge_id, criterionId: row.criterion_id, judgingAssignmentId: row.judging_assignment_id, score: row.score, feedback: row.feedback, updatedAt: row.updated_at.toISOString() }));
}

export async function beginRequest() {
  if (!pool) return;
  activeClient = await pool.connect();
  try {
    await activeClient.query('BEGIN');
    await activeClient.query('SELECT pg_advisory_xact_lock(731994205)');
    await loadPostgres(activeClient);
  } catch (error) {
    await activeClient.query('ROLLBACK').catch(() => {});
    activeClient.release(); activeClient = undefined; throw error;
  }
}

export async function finishRequest(commit = true) {
  if (!pool) return;
  const client = activeClient;
  activeClient = undefined;
  if (!client) return;
  try { await client.query(commit ? 'COMMIT' : 'ROLLBACK'); }
  finally { client.release(); }
}

export async function runLocalSerial(callback) {
  let release;
  const previous = localQueue;
  localQueue = new Promise(resolve => { release = resolve; });
  await previous;
  try { return await callback(); } finally { release(); }
}

async function persistJson() {
  await mkdir(dirname(dataFile), { recursive: true });
  const temp = `${dataFile}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify(db, null, 2), { mode: 0o600 });
  await rename(temp, dataFile);
}

export async function persist() {
  if (!pool) return persistJson();
  if (!activeClient) throw new Error('Database mutation attempted outside a request transaction');
  const client = activeClient;
  for (const user of db.users) await client.query(`INSERT INTO users(id,name,email,role,password_hash,created_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,email=EXCLUDED.email,role=EXCLUDED.role,password_hash=EXCLUDED.password_hash`, [user.id, user.name, user.email, user.role, user.passwordHash, user.createdAt]);
  for (const event of db.events) await client.query(`INSERT INTO events(id,organizer_id,title,description,venue,start_at,end_at,status,rubric,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title,description=EXCLUDED.description,venue=EXCLUDED.venue,start_at=EXCLUDED.start_at,end_at=EXCLUDED.end_at,status=EXCLUDED.status,rubric=EXCLUDED.rubric,updated_at=EXCLUDED.updated_at`, [event.id,event.organizerId,event.title,event.description,event.venue,event.startAt,event.endAt,event.status,JSON.stringify(event.rubric),event.createdAt,event.updatedAt]);
  for (const track of db.tracks) await client.query(`INSERT INTO tracks(id,event_id,name,description,created_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description`, [track.id,track.eventId,track.name,track.description,track.createdAt]);
  for (const criterion of db.criteria) await client.query(`INSERT INTO rubric_criteria(id,event_id,track_id,name,description,max_score,position) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET track_id=EXCLUDED.track_id,name=EXCLUDED.name,description=EXCLUDED.description,max_score=EXCLUDED.max_score,position=EXCLUDED.position`, [criterion.id,criterion.eventId,criterion.trackId || null,criterion.name,criterion.description,criterion.maxScore,criterion.position]);
  for (const team of db.teams) {
    await client.query(`INSERT INTO teams(id,event_id,name,created_by,created_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name`, [team.id,team.eventId,team.name,team.createdBy,team.createdAt]);
    await client.query('DELETE FROM team_members WHERE team_id=$1', [team.id]);
    for (const [position, userId] of team.memberIds.entries()) await client.query('INSERT INTO team_members(team_id,event_id,user_id,position) VALUES($1,$2,$3,$4)', [team.id,team.eventId,userId,position]);
  }
  for (const submission of db.submissions) await client.query(`INSERT INTO submissions(id,team_id,track_id,title,summary,repository_url,demo_url,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO UPDATE SET track_id=EXCLUDED.track_id,title=EXCLUDED.title,summary=EXCLUDED.summary,repository_url=EXCLUDED.repository_url,demo_url=EXCLUDED.demo_url`, [submission.id,submission.teamId,submission.trackId || null,submission.title,submission.summary,submission.repositoryUrl,submission.demoUrl,submission.createdAt]);
  for (const assignment of db.assignments) await client.query(`INSERT INTO judge_assignments(id,event_id,judge_id,created_at) VALUES($1,$2,$3,$4) ON CONFLICT(event_id,judge_id) DO NOTHING`, [assignment.id,assignment.eventId,assignment.judgeId,assignment.createdAt]);
  const assignments = db.assignments.map(item => item.id);
  if (assignments.length) await client.query('DELETE FROM judge_assignments WHERE NOT (id = ANY($1::uuid[]))', [assignments]);
  else await client.query('DELETE FROM judge_assignments');
  for (const eligibility of db.judgeTrackEligibility) await client.query(`INSERT INTO judge_track_eligibility(id,event_id,track_id,judge_id,created_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(track_id,judge_id) DO NOTHING`, [eligibility.id,eligibility.eventId,eligibility.trackId,eligibility.judgeId,eligibility.createdAt]);
  const eligibilityIds = db.judgeTrackEligibility.map(item => item.id);
  if (eligibilityIds.length) await client.query('DELETE FROM judge_track_eligibility WHERE NOT (id = ANY($1::uuid[]))', [eligibilityIds]);
  else await client.query('DELETE FROM judge_track_eligibility');
  for (const assignment of db.judgingAssignments) await client.query(`INSERT INTO judging_assignments(id,event_id,submission_id,judge_id,status,overall_feedback,assigned_at,started_at,completed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(submission_id,judge_id) DO UPDATE SET status=EXCLUDED.status,overall_feedback=EXCLUDED.overall_feedback,started_at=EXCLUDED.started_at,completed_at=EXCLUDED.completed_at`, [assignment.id,assignment.eventId,assignment.submissionId,assignment.judgeId,assignment.status,assignment.overallFeedback,assignment.assignedAt,assignment.startedAt,assignment.completedAt]);
  for (const score of db.scores) await client.query(`INSERT INTO scores(id,submission_id,event_id,judge_id,criterion_id,judging_assignment_id,score,feedback,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(judging_assignment_id,criterion_id) DO UPDATE SET id=EXCLUDED.id,score=EXCLUDED.score,feedback=EXCLUDED.feedback,updated_at=EXCLUDED.updated_at`, [score.id,score.submissionId,score.eventId,score.judgeId,score.criterionId,score.judgingAssignmentId,score.score,score.feedback,score.updatedAt]);
  const scores = db.scores.map(item => item.id);
  if (scores.length) await client.query('DELETE FROM scores WHERE NOT (id = ANY($1::uuid[]))', [scores]);
  else await client.query('DELETE FROM scores');
  const judgingAssignmentIds = db.judgingAssignments.map(item => item.id);
  if (judgingAssignmentIds.length) await client.query('DELETE FROM judging_assignments WHERE NOT (id = ANY($1::uuid[]))', [judgingAssignmentIds]);
  else await client.query('DELETE FROM judging_assignments');
  const criterionIds = db.criteria.map(item => item.id);
  if (criterionIds.length) await client.query('DELETE FROM rubric_criteria WHERE NOT (id = ANY($1::uuid[]))', [criterionIds]);
  else await client.query('DELETE FROM rubric_criteria');
}

export function storageKind() { return pool ? 'postgres' : 'json'; }
export async function closeStore() { if (pool) await pool.end(); }
export { db };
