"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiRequest } from "../../lib/api";
import styles from "./judge.module.css";

type ReviewStatus = "Needs review" | "In progress" | "Completed";
type Assignment = { id: string; name: string; team: string; track: string; status: ReviewStatus; submitted: string; mark: string; tone: "green" | "coral" | "blue" };

type AssignmentApi = { id: string; status: "assigned" | "in_progress" | "completed"; project: { id: string; title: string; track: string; submittedAt?: string; team?: { name: string } } };

function Icon({ name, size = 16 }: { name: "arrow" | "check" | "search" | "trophy"; size?: number }) {
  const paths = {
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
    trophy: <><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 7H4v2a4 4 0 0 0 4 4M17 7h3v2a4 4 0 0 1-4 4" /></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function AssignmentCard({ assignment }: { assignment: Assignment }) {
  const statusClass = assignment.status === "Completed" ? styles.statusCompleted : assignment.status === "In progress" ? styles.statusProgress : styles.statusNeeds;
  return (
    <article className={styles.assignmentCard}>
      <div className={`${styles.assignmentArtwork} ${styles[`artwork${assignment.tone}`]}`}><span>{assignment.mark}</span><small>{assignment.track.split(" ")[0]}</small></div>
      <div className={styles.assignmentBody}>
        <div className={styles.assignmentTop}><span className={styles.track}>{assignment.track}</span><span className={`${styles.status} ${statusClass}`}><i /> {assignment.status}</span></div>
        <h2>{assignment.name}</h2>
        <p className={styles.team}><span>{assignment.team.slice(0, 1)}</span> {assignment.team}</p>
        <p className={styles.submitted}>Submitted {assignment.submitted}</p>
        <Link className={styles.reviewButton} href={`/judge/projects/${assignment.id}`}>{assignment.status === "Completed" ? "View Review" : "Review Project"} <Icon name="arrow" size={14} /></Link>
      </div>
    </article>
  );
}

export default function JudgeDashboard() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [error, setError] = useState("");
  useEffect(() => {
    apiRequest<{ assignments: AssignmentApi[] }>("/api/judge/assignments").then(({ assignments: data }) => setAssignments(data.map(item => ({ id: item.project.id, name: item.project.title, team: item.project.team?.name || "HackForge team", track: item.project.track, status: item.status === "completed" ? "Completed" : item.status === "in_progress" ? "In progress" : "Needs review", submitted: item.project.submittedAt ? new Date(item.project.submittedAt).toLocaleDateString() : "Recently", mark: item.project.title.slice(0, 1), tone: "green" })))).catch(reason => setError(reason instanceof Error ? reason.message : "Assignments could not be loaded."));
  }, []);
  const visibleAssignments = useMemo(() => assignments.filter((assignment) => {
    const matchesStatus = status === "all" || assignment.status === status;
    const searchable = `${assignment.name} ${assignment.team} ${assignment.track}`.toLowerCase();
    return matchesStatus && searchable.includes(query.trim().toLowerCase());
  }), [query, status]);

  const completed = assignments.filter(item => item.status === "Completed").length;
  const inProgress = assignments.filter(item => item.status === "In progress").length;
  const progress = assignments.length ? Math.round(completed / assignments.length * 100) : 0;

  return (
    <section className={styles.dashboardContent} aria-labelledby="assigned-title">
      {error && <p role="alert">{error}</p>}
      <div className={styles.statsGrid} aria-label="Review progress">
        <article className={`${styles.statCard} ${styles.statCardAccent}`}><span className={styles.statIcon}><Icon name="trophy" size={17} /></span><p>ASSIGNED PROJECTS</p><strong>{assignments.length}</strong><small>Across assigned tracks</small></article>
        <article className={styles.statCard}><span className={`${styles.statIcon} ${styles.statIconGreen}`}><Icon name="check" size={17} /></span><p>COMPLETED REVIEWS</p><strong>{completed}</strong><small>Nice work so far</small></article>
        <article className={styles.statCard}><span className={`${styles.statIcon} ${styles.statIconCoral}`}><Icon name="arrow" size={17} /></span><p>REMAINING REVIEWS</p><strong>{assignments.length - completed}</strong><small>{inProgress} in progress</small></article>
        <article className={styles.progressCard}><div className={styles.progressTop}><p>REVIEW PROGRESS</p><strong>{progress}%</strong></div><div className={styles.progressTrack}><span style={{ width: `${progress}%` }} /></div><small>{completed} of {assignments.length} assigned projects reviewed</small></article>
      </div>

      <div className={styles.listHeading}><div><p className={styles.sectionEyebrow}>YOUR QUEUE</p><h2 id="assigned-title">Assigned projects</h2></div><span>8 total assignments</span></div>
      <div className={styles.toolbar}>
        <label className={styles.searchField}><span className={styles.visuallyHidden}>Search assigned projects</span><Icon name="search" size={16} /><input onChange={(event) => setQuery(event.target.value)} placeholder="Search projects or teams" type="search" value={query} /></label>
        <label className={styles.filterField}><span>SHOW</span><select aria-label="Filter assigned projects by status" onChange={(event) => setStatus(event.target.value)} value={status}><option value="all">All assignments</option><option value="Needs review">Needs review</option><option value="In progress">In progress</option><option value="Completed">Completed</option></select></label>
      </div>
      {visibleAssignments.length > 0 ? <div className={styles.assignmentGrid}>{visibleAssignments.map((assignment) => <AssignmentCard assignment={assignment} key={assignment.id} />)}</div> : <div className={styles.emptyState} role="status"><span><Icon name="trophy" size={22} /></span><p>NO ASSIGNMENTS FOUND</p><h2>Your judging queue is clear.</h2><small>Try another search or remove the status filter to see all assigned projects.</small><button onClick={() => { setQuery(""); setStatus("all"); }} type="button">Clear filters <Icon name="arrow" size={14} /></button></div>}
    </section>
  );
}
