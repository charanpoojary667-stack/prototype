"use client";

import { useMemo, useState } from "react";
import styles from "./judge.module.css";

type ReviewStatus = "Needs review" | "In progress" | "Completed";
type Assignment = { id: string; name: string; team: string; track: string; status: ReviewStatus; submitted: string; mark: string; tone: "green" | "coral" | "blue" };

const assignments: Assignment[] = [
  { id: "civicsignal", name: "CivicSignal", team: "Pixel Pioneers", track: "Community & civic tech", status: "Completed", submitted: "Sep 25, 2026", mark: "C", tone: "coral" },
  { id: "openshelf", name: "OpenShelf", team: "Good Neighbors", track: "Community & civic tech", status: "Needs review", submitted: "Sep 26, 2026", mark: "O", tone: "green" },
  { id: "lumen", name: "Lumen", team: "Soft Systems", track: "Climate & good futures", status: "In progress", submitted: "Sep 26, 2026", mark: "L", tone: "blue" },
  { id: "patchwork", name: "Patchwork", team: "Common Thread", track: "Open source for everyone", status: "Needs review", submitted: "Sep 27, 2026", mark: "P", tone: "green" },
  { id: "tidepool", name: "Tidepool", team: "Blue Hour", track: "Climate & good futures", status: "Needs review", submitted: "Sep 27, 2026", mark: "T", tone: "blue" },
  { id: "kindred", name: "Kindred", team: "Good Company", track: "Community & civic tech", status: "In progress", submitted: "Sep 27, 2026", mark: "K", tone: "coral" },
  { id: "commons", name: "Commons Kit", team: "Civic Stack", track: "Open source for everyone", status: "Completed", submitted: "Sep 24, 2026", mark: "C", tone: "green" },
  { id: "seedling", name: "Seedling", team: "Good Futures", track: "Climate & good futures", status: "Completed", submitted: "Sep 24, 2026", mark: "S", tone: "blue" },
];

function Icon({ name, size = 16 }: { name: "arrow" | "check" | "search" | "trophy"; size?: number }) {
  const paths = {
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
    trophy: <><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 7H4v2a4 4 0 0 0 4 4M17 7h3v2a4 4 0 0 1-4 4" /></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function AssignmentCard({ assignment, onReview }: { assignment: Assignment; onReview: (name: string) => void }) {
  const statusClass = assignment.status === "Completed" ? styles.statusCompleted : assignment.status === "In progress" ? styles.statusProgress : styles.statusNeeds;
  return (
    <article className={styles.assignmentCard}>
      <div className={`${styles.assignmentArtwork} ${styles[`artwork${assignment.tone}`]}`}><span>{assignment.mark}</span><small>{assignment.track.split(" ")[0]}</small></div>
      <div className={styles.assignmentBody}>
        <div className={styles.assignmentTop}><span className={styles.track}>{assignment.track}</span><span className={`${styles.status} ${statusClass}`}><i /> {assignment.status}</span></div>
        <h2>{assignment.name}</h2>
        <p className={styles.team}><span>{assignment.team.slice(0, 1)}</span> {assignment.team}</p>
        <p className={styles.submitted}>Submitted {assignment.submitted}</p>
        <button className={styles.reviewButton} onClick={() => onReview(assignment.name)} type="button">{assignment.status === "Completed" ? "View Review" : "Review Project"} <Icon name="arrow" size={14} /></button>
      </div>
    </article>
  );
}

export default function JudgeDashboard() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [notice, setNotice] = useState("");
  const visibleAssignments = useMemo(() => assignments.filter((assignment) => {
    const matchesStatus = status === "all" || assignment.status === status;
    const searchable = `${assignment.name} ${assignment.team} ${assignment.track}`.toLowerCase();
    return matchesStatus && searchable.includes(query.trim().toLowerCase());
  }), [query, status]);

  function handleReview(name: string) {
    setNotice(`${name} review preview opened. Judging workflows are not connected yet.`);
  }

  return (
    <section className={styles.dashboardContent} aria-labelledby="assigned-title">
      <div className={styles.statsGrid} aria-label="Review progress">
        <article className={`${styles.statCard} ${styles.statCardAccent}`}><span className={styles.statIcon}><Icon name="trophy" size={17} /></span><p>ASSIGNED PROJECTS</p><strong>8</strong><small>Across all tracks</small></article>
        <article className={styles.statCard}><span className={`${styles.statIcon} ${styles.statIconGreen}`}><Icon name="check" size={17} /></span><p>COMPLETED REVIEWS</p><strong>3</strong><small>Nice work so far</small></article>
        <article className={styles.statCard}><span className={`${styles.statIcon} ${styles.statIconCoral}`}><Icon name="arrow" size={17} /></span><p>REMAINING REVIEWS</p><strong>5</strong><small>Due Oct 11 at 6 PM</small></article>
        <article className={styles.progressCard}><div className={styles.progressTop}><p>REVIEW PROGRESS</p><strong>38%</strong></div><div className={styles.progressTrack}><span /></div><small>3 of 8 assigned projects reviewed</small></article>
      </div>

      <div className={styles.listHeading}><div><p className={styles.sectionEyebrow}>YOUR QUEUE</p><h2 id="assigned-title">Assigned projects</h2></div><span>8 total assignments</span></div>
      <div className={styles.toolbar}>
        <label className={styles.searchField}><span className={styles.visuallyHidden}>Search assigned projects</span><Icon name="search" size={16} /><input onChange={(event) => setQuery(event.target.value)} placeholder="Search projects or teams" type="search" value={query} /></label>
        <label className={styles.filterField}><span>SHOW</span><select aria-label="Filter assigned projects by status" onChange={(event) => setStatus(event.target.value)} value={status}><option value="all">All assignments</option><option value="Needs review">Needs review</option><option value="In progress">In progress</option><option value="Completed">Completed</option></select></label>
      </div>
      {notice && <p className={styles.notice} role="status"><Icon name="check" size={14} /> {notice}</p>}
      {visibleAssignments.length > 0 ? <div className={styles.assignmentGrid}>{visibleAssignments.map((assignment) => <AssignmentCard assignment={assignment} key={assignment.id} onReview={handleReview} />)}</div> : <div className={styles.emptyState} role="status"><span><Icon name="trophy" size={22} /></span><p>NO ASSIGNMENTS FOUND</p><h2>Your judging queue is clear.</h2><small>Try another search or remove the status filter to see all assigned projects.</small><button onClick={() => { setQuery(""); setStatus("all"); }} type="button">Clear filters <Icon name="arrow" size={14} /></button></div>}
      <p className={styles.previewNote}><span /> Frontend preview only. Judge access and review submissions are not connected.</p>
    </section>
  );
}