# DOGFOOD Hackathon Judging Platform

Backend API for running a hackathon: organizers create events and scoring rubrics, participants form teams and submit projects, and assigned judges score those projects. Local development uses a JSON file; deployed environments use PostgreSQL.

## Run locally

Requires Node.js 20 or later.

```powershell
cd backend
npm.cmd install
npm.cmd run dev
```

The API listens on `http://localhost:4000`. Without `DATABASE_URL`, local development data is stored in `backend/data/db.json`. Set a random `JWT_SECRET` of at least 32 characters in production. Public registration creates participant accounts; organizer and judge accounts require invite codes.

## Verify the full workflow

```powershell
cd backend
npm.cmd run check:workflow
```

The integration check starts a temporary API and data file, then verifies registration, login, event creation, rubric setup, judge assignment, team submission, scoring, and participant leaderboard access. It removes temporary data when finished.

## PostgreSQL and deployment

Production storage uses PostgreSQL tables with foreign keys, uniqueness and score constraints, and database transactions. Rubric criteria are normalized into `rubric_criteria`; tracks and judge eligibility use `tracks` and `judge_track_eligibility`; each submission/judge pair has a `judging_assignments` row, and `scores` references both that assignment and a criterion. The schema in `backend/db/schema.sql` creates the new structures and backfills existing event rubric JSON and score assignments. To run PostgreSQL and the API locally with Docker Compose, set `JWT_SECRET`, `ORGANIZER_INVITE_CODE`, and `JUDGE_INVITE_CODE` in your terminal environment, then run this from the repository root:

```powershell
docker compose -f backend/docker-compose.yml up --build
```

The API is then available at `http://localhost:4000/api/health`.

The root `render.yaml` provisions a Render web service and managed PostgreSQL database. Push this repository to GitHub, create a new Blueprint in Render, and select the repository. Render generates the token-signing and invite-code secrets; use the generated invite values from the service environment when registering organizer and judge accounts. The blueprint uses paid Render service and database plans; review pricing before creating resources. Deployment does not automatically move local JSON records into PostgreSQL, so production starts with a fresh database unless you explicitly migrate local data.

The API serializes PostgreSQL transactions to preserve the current workflow safely across instances. This suits a small hackathon deployment; sustained higher traffic will need targeted database queries before scaling horizontally.

## Workflow

1. Register an organizer, a judge, and participant accounts.
2. Organizer creates an event, sets its rubric, assigns judges, then publishes it.
3. Participants create teams and submit projects.
4. Assigned judges score every rubric criterion and provide feedback.
5. Organizer completes the event to reveal the participant leaderboard.

All routes are under `/api`. Authenticated routes accept `Authorization: Bearer <token>`. Request and response bodies use JSON.

## Endpoints

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/api/health` | Public | Health check |
| POST | `/api/auth/register` | Public | Register `{name,email,password,role?,inviteCode?}` |
| POST | `/api/auth/login` | Public | Login `{email,password}` |
| GET | `/api/auth/me` | Signed in | Current account |
| GET, POST | `/api/events` | Signed in / organizer | List accessible events or create one |
| GET, PATCH | `/api/events/:eventId` | Event member / organizer | Read or update event |
| PUT | `/api/events/:eventId/rubric` | Organizer | Set rubric criteria while draft |
| POST, GET | `/api/events/:eventId/tracks` | Organizer / event member | Create or list tracks; tracks may have their own rubric criteria |
| POST | `/api/events/:eventId/judges` | Organizer | Assign judge by email |
| POST | `/api/events/:eventId/tracks/:trackId/judges` | Organizer | Add a track-eligible event judge by email |
| GET | `/api/events/:eventId/judging-assignments` | Organizer / assigned judge | List project-level judging assignments |
| DELETE | `/api/events/:eventId/judges/:judgeId` | Organizer | Remove judge assignment |
| POST | `/api/events/:eventId/publish` | Organizer | Publish event |
| POST | `/api/events/:eventId/complete` | Organizer | Complete event and reveal participant leaderboard |
| GET | `/api/events/:eventId/teams` | Event member | List teams |
| GET | `/api/events/:eventId/submissions` | Organizer / assigned judge | List event submissions |
| GET | `/api/events/:eventId/leaderboard` | Organizer / assigned judge; participants after completion | Ranked scores |
| POST | `/api/teams` | Participant | Create a team |
| POST | `/api/teams/:teamId/join` | Participant | Join a team (up to six members) |
| POST | `/api/teams/:teamId/submissions` | Team member | Submit project details and links |
| GET | `/api/submissions/:submissionId` | Team member / event staff | Read submission |
| PUT | `/api/submissions/:submissionId/scores` | Assigned judge | Save a score and feedback per criterion |
| GET | `/api/submissions/:submissionId/scores` | Organizer / assigned judge | Read scores and feedback |
| PATCH | `/api/judging-assignments/:assignmentId` | Assigned judge / organizer | Change assignment state; completion requires all rubric scores |

Local JSON files are for development only. When `DATABASE_URL` is set, the API stores event, team, membership, submission, judge assignment, and score data in PostgreSQL.
