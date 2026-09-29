"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "../../../lib/api";
import type { ProjectRecord } from "../project-data";
import SubmissionPanel from "./submission-panel";

type ProjectApi = { id: string; title: string; tagline: string; summary: string; trackId: string; track: string; repositoryUrl: string; demoUrl: string; tags: string[]; updatedAt: string; status: string; team?: { id: string; name: string; members: { id: string; name: string }[] }; event?: { submissionDeadline?: string; slug?: string; id?: string; title?: string } };

export default function SubmissionLoader({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [status, setStatus] = useState("DRAFT");
  const [eventSlug, setEventSlug] = useState("demo-event");
  const [eventTitle, setEventTitle] = useState("DOGFOOD Hackathon");
  const [deadline, setDeadline] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    apiRequest<{ project: ProjectApi }>(`/api/projects/${projectId}`).then(({ project: item }) => {
      setStatus(item.status); setDeadline(item.event?.submissionDeadline || ""); setEventSlug(item.event?.slug || item.event?.id || "demo-event"); setEventTitle(item.event?.title || "DOGFOOD Hackathon");
      setProject({ id: item.id, name: item.title, tagline: item.tagline, description: item.summary, trackId: item.trackId, trackName: item.track, repositoryUrl: item.repositoryUrl || "#", demoUrl: item.demoUrl || "#", technologies: item.tags || [], teamName: item.team?.name || "Your team", teamMembers: (item.team?.members || []).map(member => ({ id: member.id, name: member.name, role: "Team member", initials: member.name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase() })), updatedAt: new Date(item.updatedAt).toLocaleString() });
    }).catch(reason => setError(reason instanceof Error ? reason.message : "Submission could not be loaded."));
  }, [projectId]);
  if (error) return <p role="alert">{error}</p>;
  if (!project) return <p role="status">Loading submission status…</p>;
  return <><p><a href={`/events/${encodeURIComponent(eventSlug)}`}>Event: {eventTitle}</a></p><SubmissionPanel project={project} initialStatus={status} deadline={deadline} /></>;
}
