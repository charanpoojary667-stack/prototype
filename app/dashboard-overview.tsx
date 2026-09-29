"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "./lib/api";

type Overview = { user: { name: string }; registered: boolean; team: { id: string; name: string; memberIds: string[]; members: { id: string; name: string }[] } | null; project: { id: string; title: string; tagline: string; status: string; summary: string } | null };

export default function DashboardOverview() {
  const [data, setData] = useState<Overview | null>(null);
  useEffect(() => { apiRequest<Overview>("/api/dashboard").then(setData).catch(() => setData(null)); }, []);
  const projectProgress = data?.project ? (data.project.status === "SUBMITTED" ? 100 : data.project.tagline ? 72 : 45) : 0;
  return <section className="overview-section" aria-label="Your hackathon overview">
    <article className="summary-card team-card" id="my-team"><div className="summary-card-top"><span className="icon-tile icon-tile--green">♧</span><span className="card-kicker">YOUR TEAM</span><Link href="/teams/demo-team" className="icon-link" aria-label="View your team">›</Link></div><h3>{data?.team?.name || "No team yet"}</h3><p className="card-copy">{data?.team ? "Building together for DOGFOOD" : "Register for the event and find your crew."}</p><div className="team-card-bottom"><div className="avatar-stack" aria-label={`${data?.team?.members.length || 0} team members`}>{data?.team?.members.slice(0, 4).map((member, index) => <span className={`mini-avatar mini-avatar--${["coral", "blue", "yellow", "lavender"][index]}`} key={member.id}>{member.name.split(/\s+/).map(part => part[0]).join("").slice(0, 2)}</span>)}</div><span className="member-count">{data?.team?.memberIds.length || 0} <span>members</span></span></div></article>
    <article className="summary-card project-summary" id="my-project"><div className="summary-card-top"><span className="icon-tile icon-tile--peach">✎</span><span className="card-kicker">YOUR PROJECT</span><Link href={data?.project ? `/projects/${data.project.id}` : "/projects/new"} className="icon-link" aria-label="Open your project">›</Link></div><h3>{data?.project?.title || "Start a project"}</h3><p className="card-copy">{data?.project?.tagline || data?.project?.summary || "Capture the idea your team wants to build."}</p><div className="project-progress-row"><span>Project profile</span><strong>{projectProgress}%</strong></div><div className="progress-track"><span style={{ width: `${projectProgress}%` }} /></div></article>
    <article className="summary-card submission-card"><div className="summary-card-top"><span className="icon-tile icon-tile--yellow">✓</span><span className="card-kicker">SUBMISSION STATUS</span><span className="status-pill"><span /> {data?.project?.status === "SUBMITTED" ? "SUBMITTED" : data?.project ? "DRAFT" : "NOT STARTED"}</span></div><h3>{data?.project?.status === "SUBMITTED" ? "Project submitted." : data?.project ? "Keep building." : "Ready when you are."}</h3><p className="card-copy">{data?.project ? "Your project status is saved to the event workspace." : "Create a team project to prepare a submission."}</p><div className="submission-deadline"><Link href={data?.project ? `/projects/${data.project.id}/submission` : "/events/demo-event"}>{data?.project ? "Open submission" : "Join the event"} ›</Link></div></article>
  </section>;
}
