"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "../../lib/api";
import styles from "./organizer.module.css";

type Submission = { id: string; name: string; team: string; track: string; submitted: string; status: "Submitted" | "In review" | "Draft"; tone: "green" | "coral" | "blue" };

function Icon({ name, size = 16 }: { name: "arrow" | "calendar" | "check" | "edit" | "grid" | "people" | "search" | "settings" | "spark" | "trophy"; size?: number }) {
  const paths = {
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />, calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>, check: <path d="m5 12 4 4L19 6" />,
    edit: <><path d="m15 5 4 4M4 20l4.5-1 10.8-10.8a2.1 2.1 0 0 0-3-3L5.5 16 4 20Z" /><path d="M13 7 17 11" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    people: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
    search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>, settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.8 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.8-1l-1.7.6-1.4-2.4 1.4-1.1a7 7 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.8-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.8 1l1.7-.6 1.4 2.4-1.4 1.1a7 7 0 0 1 0 2Z" transform="translate(-1 -1)" /></>,
    spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2L12 3Z" /><path d="m19 14 1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2L19 14Z" /></>, trophy: <><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 7H4v2a4 4 0 0 0 4 4M17 7h3v2a4 4 0 0 1-4 4" /></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function QuickAction({ label, icon, onClick }: { label: string; icon: "calendar" | "edit" | "people" | "settings" | "trophy"; onClick: () => void }) {
  return <button className={styles.quickAction} onClick={onClick} type="button"><span><Icon name={icon} size={17} /></span><strong>{label}</strong><Icon name="arrow" size={14} /></button>;
}

function SubmissionRow({ submission }: { submission: Submission }) {
  const statusClass = submission.status === "Submitted" ? styles.submitted : submission.status === "In review" ? styles.inReview : styles.draft;
  return <article className={styles.submissionRow}><span className={`${styles.projectMark} ${styles[`mark${submission.tone}`]}`}>{submission.name.slice(0, 1)}</span><div className={styles.submissionProject}><strong>{submission.name}</strong><small>{submission.team}</small></div><span className={styles.trackLabel}>{submission.track}</span><span className={styles.submittedAt}>{submission.submitted}</span><span className={`${styles.submissionStatus} ${statusClass}`}><i /> {submission.status}</span><Link href={`/projects/${submission.id}/view`} aria-label={`View ${submission.name}`}><Icon name="arrow" size={14} /></Link></article>;
}

export default function OrganizerDashboard() {
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [metrics, setMetrics] = useState<{ participants: number; teams: number; projects: number; submittedProjects: number; judges: number; judgingProgress: number; assignedReviews: number; inProgressReviews: number; completedReviews: number; votes: number; deadline: string } | null>(null);
  const [resultsPublic, setResultsPublic] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    Promise.all([apiRequest<{ metrics: typeof metrics; event: { resultsPublic: boolean } }>("/api/organizer/dashboard"), apiRequest<{ projects: { id: string; title: string; track: string; createdAt: string; team?: { name: string } }[] }>("/api/gallery")])
      .then(([dashboard, gallery]) => {
        if (dashboard.metrics) setMetrics(dashboard.metrics);
        setResultsPublic(dashboard.event.resultsPublic);
        setSubmissions(gallery.projects.map((project, index) => ({ id: project.id, name: project.title, team: project.team?.name || "HackForge team", track: project.track, submitted: new Date(project.createdAt).toLocaleDateString(), status: "Submitted", tone: (["green", "coral", "blue"] as const)[index % 3] })));
      }).catch(reason => setLoadError(reason instanceof Error ? reason.message : "Organizer data could not be loaded."));
  }, []);
  const visibleSubmissions = submissions.filter((submission) => `${submission.name} ${submission.team} ${submission.track}`.toLowerCase().includes(query.trim().toLowerCase()));
  const action = (label: string) => { if (label === "Manage Event") window.location.href = "/organizer/events/demo-event/edit"; else if (label === "Manage Judges") window.location.href = "/organizer/judges"; else if (label === "View Results") window.location.href = "/results"; else if (label === "Manage Projects") window.location.href = "/gallery"; else setNotice("Team information is available from the event workspace."); };
  async function publishResults() {
    try { await apiRequest("/api/organizer/results", { method: "POST", body: JSON.stringify({ eventId: "demo-event", public: true }) }); setResultsPublic(true); setNotice("Results are now visible to participants."); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Results could not be published."); }
  }

  return <>
    {loadError && <p role="alert">{loadError}</p>}
    <header className={styles.welcomeHeader}><div><p className={styles.eyebrow}><span /> DOGFOOD HACKATHON <i /> ORGANIZER CONSOLE</p><h1>Organizer dashboard</h1><p>Live event activity and review progress.</p></div><span className={styles.liveBadge}><i /> EVENT LIVE</span></header>
    <section className={styles.eventBanner} aria-labelledby="event-title"><div><p className={styles.bannerEyebrow}>CURRENT EVENT</p><h2 id="event-title">DOGFOOD Hackathon</h2><span>Fall 2026 <i /> Online · Open source community event</span></div><div className={styles.bannerDeadline}><small>SUBMISSION DEADLINE</small><strong>Oct 11</strong><span>6:00 PM UTC</span></div></section>
    <section className={styles.metricsGrid} aria-label="Event overview"><article className={styles.metricCard}><span className={styles.metricIcon}><Icon name="people" size={17} /></span><p>TOTAL PARTICIPANTS</p><strong>{metrics?.participants ?? "—"}</strong><small>Event registrations</small></article><article className={`${styles.metricCard} ${styles.greenIcon}`}><span className={styles.metricIcon}><Icon name="people" size={17} /></span><p>TOTAL TEAMS</p><strong>{metrics?.teams ?? "—"}</strong><small>Registered event teams</small></article><article className={styles.metricCard}><span className={`${styles.metricIcon} ${styles.blueIcon}`}><Icon name="grid" size={17} /></span><p>TOTAL PROJECTS</p><strong>{metrics?.projects ?? "—"}</strong><small>All team projects</small></article><article className={`${styles.metricCard} ${styles.accentMetric}`}><span className={`${styles.metricIcon} ${styles.coralIcon}`}><Icon name="check" size={17} /></span><p>SUBMITTED PROJECTS</p><strong>{metrics?.submittedProjects ?? "—"}</strong><small>Ready for review</small></article></section>
    <section className={styles.quickSection} aria-labelledby="quick-actions-title"><div className={styles.sectionHeading}><div><p>RUN THE EVENT</p><h2 id="quick-actions-title">Quick actions</h2></div></div><div className={styles.quickGrid}><QuickAction label="Manage Event" icon="calendar" onClick={() => action("Manage Event")} /><QuickAction label="Manage Teams" icon="people" onClick={() => action("Manage Teams")} /><QuickAction label="Manage Projects" icon="edit" onClick={() => action("Manage Projects")} /><QuickAction label="Manage Judges" icon="settings" onClick={() => action("Manage Judges")} /><QuickAction label="View Results" icon="trophy" onClick={() => action("View Results")} /></div>{notice && <p className={styles.notice} role="status"><Icon name="check" size={14} /> {notice}</p>}</section>
    <div className={styles.dashboardGrid}><section className={styles.panel} aria-labelledby="judging-title"><div className={styles.panelHeading}><div><p>REVIEW OPERATIONS</p><h2 id="judging-title">Judging progress</h2></div><span>{metrics?.judges ?? 0} judges assigned</span></div><div className={styles.judgingRows}><div><span className={`${styles.judgingIcon} ${styles.judgingBlue}`}><Icon name="people" size={15} /></span><div><strong>Assigned reviews</strong><small>Across all judges</small></div><b>{metrics?.assignedReviews ?? 0}</b></div><div><span className={`${styles.judgingIcon} ${styles.judgingYellow}`}><Icon name="edit" size={15} /></span><div><strong>In progress</strong><small>Currently being reviewed</small></div><b>{metrics?.inProgressReviews ?? 0}</b></div><div><span className={`${styles.judgingIcon} ${styles.judgingGreen}`}><Icon name="check" size={15} /></span><div><strong>Completed reviews</strong><small>Ready for results</small></div><b>{metrics?.completedReviews ?? 0}</b></div></div><div className={styles.judgingBar}><span style={{ width: `${metrics?.judgingProgress ?? 0}%` }} /></div><div className={styles.progressLabel}><span>{metrics?.judgingProgress ?? 0}% complete</span><span>{metrics?.completedReviews ?? 0} of {metrics?.assignedReviews ?? 0} reviews</span></div></section><section className={styles.panel} aria-labelledby="voting-title"><div className={styles.panelHeading}><div><p>COMMUNITY SIGNAL</p><h2 id="voting-title">Community voting</h2></div><span className={styles.openPill}>OPEN</span></div><div className={styles.votingBody}><span className={styles.votingIcon}><Icon name="spark" size={21} /></span><div><strong>Voting is live</strong><p>{metrics?.votes ?? 0} persistent community votes recorded.</p></div></div><div className={styles.votingFooter}><span>Submission deadline {metrics?.deadline ? new Date(metrics.deadline).toLocaleString() : "—"}</span><button onClick={publishResults} type="button">{resultsPublic ? "Results published" : "Publish results"} <Icon name="arrow" size={13} /></button></div></section></div>
    <section className={styles.submissionsPanel} aria-labelledby="submissions-title"><div className={styles.panelHeading}><div><p>JUST IN</p><h2 id="submissions-title">Recent submissions</h2></div><Link href="/gallery">View all projects <Icon name="arrow" size={14} /></Link></div><div className={styles.submissionToolbar}><label className={styles.searchField}><span className={styles.visuallyHidden}>Search submissions</span><Icon name="search" size={15} /><input onChange={(event) => setQuery(event.target.value)} placeholder="Search projects or teams" type="search" value={query} /></label><span>{visibleSubmissions.length} of {submissions.length}</span></div><div className={styles.submissionList}>{visibleSubmissions.length > 0 ? visibleSubmissions.map((submission) => <SubmissionRow key={submission.id} submission={submission} />) : <div className={styles.emptyState}><span><Icon name="search" size={21} /></span><h3>No submissions found</h3><p>Try a different project or team name.</p></div>}</div></section>
  </>;
}
