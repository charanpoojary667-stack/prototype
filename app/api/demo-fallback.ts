import seedData from "../../backend/demo/public-seed.json";

type DemoProject = {
  id: string;
  title: string;
  tagline: string;
  summary: string;
  track: string;
  tags: string[];
  createdAt: string;
  event: { id: string; slug: string; resultsPublic: boolean; votingEnabled: boolean };
};

type DemoSeed = {
  events: { id: string; slug: string }[];
  eventDetails: Record<string, { id: string; slug: string; resultsPublic: boolean }>;
  projects: DemoProject[];
  comments: { projectId: string }[];
  voteCounts: Record<string, number>;
  leaderboards: Record<string, unknown[]>;
  stats: { projects: number; teams: number; judges: number; events: number };
};

const demo = seedData as DemoSeed;
const headers = { "Cache-Control": "no-store" };

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers });
}

export function demoFallbackResponse(request: Request, endpoint: string) {
  if (request.method !== "GET") {
    return json({ error: "This Vercel demo is read-only. Configure HACKFORGE_API_URL to enable sign-in and changes." }, 503);
  }

  const url = new URL(request.url);
  if (endpoint === "health") return json({ status: "ok", mode: "read-only-demo" });
  if (endpoint === "platform/stats") return json({ stats: demo.stats });
  if (endpoint === "events") return json({ events: demo.events });
  if (endpoint === "gallery" || endpoint === "projects") {
    const query = (url.searchParams.get("q") || "").trim().toLowerCase();
    const track = url.searchParams.get("track");
    const projects = demo.projects.filter(project => {
      const matchesQuery = !query || [project.title, project.tagline, project.summary, project.track, ...project.tags].join(" ").toLowerCase().includes(query);
      return matchesQuery && (!track || track === "all" || project.track === track);
    });
    return json({ projects });
  }

  const parts = endpoint.split("/");
  if (parts[0] === "events" && parts.length === 2) {
    const event = demo.eventDetails[parts[1]] || Object.values(demo.eventDetails).find(item => item.id === parts[1]);
    return event ? json({ event }) : json({ error: "Event not found" }, 404);
  }
  if (parts[0] === "events" && parts.length === 3 && parts[2] === "leaderboard") {
    const event = demo.eventDetails[parts[1]] || Object.values(demo.eventDetails).find(item => item.id === parts[1]);
    if (!event) return json({ error: "Event not found" }, 404);
    const leaderboard = demo.leaderboards[event.slug];
    return leaderboard ? json({ leaderboard }) : json({ error: "Results have not been published" }, 403);
  }
  if (parts[0] === "projects" && parts.length === 2) {
    const project = demo.projects.find(item => item.id === parts[1]);
    if (!project) return json({ error: "Project not found" }, 404);
    const projectComments = (seedData as DemoSeed & { comments: { id: string; projectId: string; body: string; createdAt: string; author: { id: string; name: string } }[] }).comments.filter(comment => comment.projectId === project.id);
    const votes = project.event.votingEnabled && !project.event.resultsPublic ? null : demo.voteCounts[project.id] || 0;
    return json({ project, comments: projectComments, votes, hasVoted: false });
  }

  if (endpoint === "auth/me" || endpoint === "dashboard" || endpoint.startsWith("judge/") || endpoint.startsWith("organizer/")) {
    return json({ error: "Authentication requires a connected HackForge API. Configure HACKFORGE_API_URL to enable sign-in." }, 401);
  }
  return json({ error: "This API route requires a connected HackForge API. Configure HACKFORGE_API_URL to enable it." }, 503);
}
