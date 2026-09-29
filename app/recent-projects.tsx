"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "./lib/api";

type GalleryProject = { id: string; title: string; tagline: string; summary: string; track: string; team?: { name: string } | null };

export default function RecentProjects() {
  const [projects, setProjects] = useState<GalleryProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    apiRequest<{ projects: GalleryProject[] }>("/api/gallery").then(({ projects: data }) => { if (active) { setProjects(data.slice(0, 3)); setError(""); } })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Projects could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);
  if (loading) return <p className="recent-state" role="status">Loading recent projects…</p>;
  if (error) return <div className="recent-state recent-state--error" role="alert">Projects could not be loaded. {error} <button type="button" onClick={() => { setLoading(true); setAttempt(value => value + 1); }}>Retry</button></div>;
  if (!projects.length) return <p className="recent-state">No submitted projects yet. Be the first to share a build.</p>;
  return <div className="recent-projects">{projects.map((project, index) => <Link className="recent-project" href={`/projects/${project.id}/view`} key={project.id}>
    <div className={`project-art project-art--${["shelf", "lumen", "patchwork"][index % 3]}`} role="img" aria-label={`${project.title} project preview`}><span className="art-mark">{project.title.slice(0, 1)}</span><span className="project-category">{project.track}</span></div>
    <div className="project-info"><div className="project-title-row"><h3>{project.title}</h3><span className="project-likes">SUBMITTED</span></div><p>{project.tagline || project.summary}</p><div className="project-team"><span className="team-dot">{project.team?.name.slice(0, 1) || "H"}</span> {project.team?.name || "HackForge team"}</div></div>
  </Link>)}</div>;
}
