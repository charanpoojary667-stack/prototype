"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/api";
import type { ProjectRecord } from "./project-data";
import ProjectDetailsForm from "./project-details-form";
import detailStyles from "./details.module.css";
import projectStyles from "../new/project.module.css";

type Project = { id: string; title: string; tagline: string; summary: string; trackId: string; track: string; repositoryUrl: string; demoUrl: string; tags: string[]; updatedAt: string; event?: { id: string; slug: string; title: string }; team?: { members: { id: string; name: string }[] } | null };

export default function ProjectDetailsLoader({ projectId }: { projectId: string }) {
  const [eventSlug, setEventSlug] = useState("demo-event");
  const [eventTitle, setEventTitle] = useState("DOGFOOD HACKATHON");
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    apiRequest<{ project: Project }>(`/api/projects/${projectId}`).then(({ project: item }) => { setEventSlug(item.event?.slug || item.event?.id || "demo-event"); setEventTitle(item.event?.title || "DOGFOOD HACKATHON"); setProject({
      id: item.id, name: item.title, tagline: item.tagline, description: item.summary, trackId: item.trackId || "", trackName: item.track,
      repositoryUrl: item.repositoryUrl, demoUrl: item.demoUrl, technologies: item.tags || [], teamName: "Your team",
      teamMembers: (item.team?.members || []).map(member => ({ id: member.id, name: member.name, role: "Team member", initials: member.name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase() })),
      updatedAt: new Date(item.updatedAt).toLocaleString(),
    }); }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Project could not be loaded."));
  }, [projectId]);
  if (error) return <section role="alert" className={detailStyles.emptyState}><p>{error}</p><a href="/login">Sign in</a></section>;
  if (!project) return <p role="status">Loading project draft…</p>;
  return <>
    <header className={`${projectStyles.pageHeading} ${detailStyles.detailsHeading}`}>
      <div><p className={projectStyles.pageEyebrow}><span /> {eventTitle} <i /> PROJECT PROFILE</p><h1>Edit your project</h1><p>Keep your team’s project details current as the idea takes shape.</p></div>
      <span className={detailStyles.statusBadge}><i /> DRAFT SUBMISSION</span>
    </header>
    <p><a href={`/events/${encodeURIComponent(eventSlug)}`}>Back to {eventTitle}</a></p>
    <ProjectDetailsForm project={project} eventSlug={eventSlug} />
  </>;
}
