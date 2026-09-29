"use client";

import { useState, type FormEvent } from "react";
import styles from "./judges.module.css";

type JudgeStatus = "Active" | "Invited" | "Inactive";
type Judge = { id: string; name: string; email: string; status: JudgeStatus; completedReviews: number; color: string };
type ProjectAssignment = { id: number; judgeId: string; project: string; team: string };
type StatusFilter = "All judges" | JudgeStatus;

const initialJudges: Judge[] = [
  { id: "maya", name: "Maya Patel", email: "maya.patel@northstar.dev", status: "Active", completedReviews: 3, color: "sage" },
  { id: "oliver", name: "Oliver Grant", email: "oliver@fieldnotes.studio", status: "Active", completedReviews: 3, color: "coral" },
  { id: "samira", name: "Samira Okafor", email: "samira@commonthread.org", status: "Active", completedReviews: 1, color: "blue" },
  { id: "theo", name: "Theo Brooks", email: "theo.brooks@hey.com", status: "Invited", completedReviews: 0, color: "gold" },
  { id: "jules", name: "Jules Park", email: "jules@brightworks.design", status: "Inactive", completedReviews: 1, color: "lilac" },
];

const initialAssignments: ProjectAssignment[] = [
  { id: 1, judgeId: "maya", project: "CivicSignal", team: "Pixel Pioneers" },
  { id: 2, judgeId: "maya", project: "OpenShelf", team: "Good Neighbors" },
  { id: 3, judgeId: "maya", project: "Lumen", team: "Soft Systems" },
  { id: 4, judgeId: "maya", project: "Patchwork", team: "Common Thread" },
  { id: 5, judgeId: "oliver", project: "CivicSignal", team: "Pixel Pioneers" },
  { id: 6, judgeId: "oliver", project: "Tidepool", team: "Blue Current" },
  { id: 7, judgeId: "oliver", project: "GoodMeasure", team: "Small Signals" },
  { id: 8, judgeId: "samira", project: "OpenShelf", team: "Good Neighbors" },
  { id: 9, judgeId: "samira", project: "Patchwork", team: "Common Thread" },
  { id: 10, judgeId: "jules", project: "Lumen", team: "Soft Systems" },
];

const projects = [
  { name: "CivicSignal", team: "Pixel Pioneers" },
  { name: "OpenShelf", team: "Good Neighbors" },
  { name: "Lumen", team: "Soft Systems" },
  { name: "Patchwork", team: "Common Thread" },
  { name: "Tidepool", team: "Blue Current" },
  { name: "GoodMeasure", team: "Small Signals" },
];

function Icon({ name, size = 16 }: { name: "check" | "close" | "mail" | "plus" | "search" | "spark"; size?: number }) {
  const paths = {
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
    spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2L12 3Z" /><path d="m19 14 1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2L19 14Z" /></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).slice(0, 2).join("");
}

export default function JudgeManagement() {
  const [judges, setJudges] = useState(initialJudges);
  const [assignments, setAssignments] = useState(initialAssignments);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All judges");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [notice, setNotice] = useState("");
  const [assignmentJudge, setAssignmentJudge] = useState("");
  const [assignmentProject, setAssignmentProject] = useState("");
  const [assignmentError, setAssignmentError] = useState("");
  const [inviteClosing, setInviteClosing] = useState(false);

  function closeInvite() {
    if (inviteClosing) return;
    setInviteClosing(true);
    const closeDelay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 160;
    window.setTimeout(() => {
      setInviteOpen(false);
      setInviteClosing(false);
    }, closeDelay);
  }

  const visibleJudges = judges.filter((judge) => {
    const matchesQuery = `${judge.name} ${judge.email}`.toLowerCase().includes(query.trim().toLowerCase());
    return matchesQuery && (statusFilter === "All judges" || judge.status === statusFilter);
  });
  const completedReviews = judges.reduce((total, judge) => total + judge.completedReviews, 0);
  const activeJudges = judges.filter((judge) => judge.status === "Active").length;

  function inviteJudge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    if (judges.some((judge) => judge.email.toLowerCase() === email.toLowerCase())) {
      setInviteError("A judge with this email is already on the list.");
      return;
    }

    setJudges((current) => [...current, { id: `judge-${Date.now()}`, name, email, status: "Invited", completedReviews: 0, color: "blue" }]);
    closeInvite();
    setInviteError("");
    setNotice(`Invite recorded for ${name}. This is a local preview; no email was sent.`);
  }

  function addAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const judge = judges.find((candidate) => candidate.id === assignmentJudge);
    const project = projects.find((candidate) => candidate.name === assignmentProject);
    if (!judge || !project) {
      setAssignmentError("Choose a judge and project to add an assignment.");
      return;
    }
    if (assignments.some((assignment) => assignment.judgeId === judge.id && assignment.project === project.name)) {
      setAssignmentError(`${judge.name} is already assigned to ${project.name}.`);
      return;
    }

    setAssignments((current) => [...current, { id: Date.now(), judgeId: judge.id, project: project.name, team: project.team }]);
    setAssignmentJudge("");
    setAssignmentProject("");
    setAssignmentError("");
    setNotice(`${project.name} assigned to ${judge.name}. This change is only in this preview.`);
  }

  function removeAssignment(assignment: ProjectAssignment) {
    setAssignments((current) => current.filter((item) => item.id !== assignment.id));
    setNotice(`${assignment.project} was removed from the mock assignments.`);
  }

  return <>
    <header className={styles.pageHeader}>
      <div><p className={styles.eyebrow}><span /> DOGFOOD HACKATHON <i /> PEOPLE &amp; REVIEWS</p><h1>Judge Management</h1><p>Keep your review team organized and the judging work moving.</p></div>
      <button className={styles.primaryButton} onClick={() => { setInviteError(""); setInviteClosing(false); setInviteOpen(true); }} type="button"><Icon name="plus" size={16} /> Invite Judge</button>
    </header>

    {notice && <div className={styles.notice} role="status"><Icon name="check" size={15} /><span>{notice}</span><button aria-label="Dismiss message" onClick={() => setNotice("")} type="button"><Icon name="close" size={14} /></button></div>}

    <section className={styles.metrics} aria-label="Judge overview">
      <article className={styles.metric}><span className={`${styles.metricMark} ${styles.markGreen}`}><Icon name="spark" size={17} /></span><div><p>JUDGES ON ROSTER</p><strong>{judges.length}</strong></div><small>{activeJudges} active</small></article>
      <article className={styles.metric}><span className={`${styles.metricMark} ${styles.markGold}`}><Icon name="mail" size={17} /></span><div><p>PROJECT ASSIGNMENTS</p><strong>{assignments.length}</strong></div><small>Across all judges</small></article>
      <article className={styles.metric}><span className={`${styles.metricMark} ${styles.markBlue}`}><Icon name="check" size={17} /></span><div><p>REVIEWS COMPLETED</p><strong>{completedReviews}</strong></div><small>Ready for results</small></article>
    </section>

    <section className={styles.judgeSection} aria-labelledby="judges-title">
      <div className={styles.sectionHeading}><div><p>YOUR REVIEW TEAM</p><h2 id="judges-title">Judges</h2></div><span>{visibleJudges.length} of {judges.length}</span></div>
      <div className={styles.toolbar}>
        <label className={styles.searchField}><span className={styles.visuallyHidden}>Search judges</span><Icon name="search" size={16} /><input onChange={(event) => setQuery(event.target.value)} placeholder="Search name or email" type="search" value={query} /></label>
        <div className={styles.filters} aria-label="Filter judges by status">{(["All judges", "Active", "Invited", "Inactive"] as const).map((filter) => <button aria-pressed={statusFilter === filter} className={statusFilter === filter ? styles.filterActive : ""} key={filter} onClick={() => setStatusFilter(filter)} type="button">{filter}</button>)}</div>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.judgeTable}>
          <thead><tr><th scope="col">JUDGE</th><th scope="col">STATUS</th><th scope="col">ASSIGNED PROJECTS</th><th scope="col">COMPLETED REVIEWS</th></tr></thead>
          <tbody>{visibleJudges.map((judge) => {
            const assignedCount = assignments.filter((assignment) => assignment.judgeId === judge.id).length;
            const statusClass = judge.status === "Active" ? styles.statusActive : judge.status === "Invited" ? styles.statusInvited : styles.statusInactive;
            return <tr key={judge.id}>
              <td data-label="Judge"><div className={styles.judgeIdentity}><span className={`${styles.avatar} ${styles[judge.color]}`}>{initials(judge.name)}</span><span><strong>{judge.name}</strong><small>{judge.email}</small></span></div></td>
              <td data-label="Status"><span className={`${styles.status} ${statusClass}`}><i />{judge.status}</span></td>
              <td data-label="Assigned projects"><span className={styles.count}>{assignedCount}</span><span className={styles.countLabel}>projects</span></td>
              <td data-label="Completed reviews"><span className={styles.count}>{judge.completedReviews}</span><span className={styles.countLabel}>reviews</span></td>
            </tr>;
          })}</tbody>
        </table>
        {visibleJudges.length === 0 && <div className={styles.emptyState}><span><Icon name="search" size={21} /></span><h3>No judges found</h3><p>Try another name, email, or status filter.</p><button onClick={() => { setQuery(""); setStatusFilter("All judges"); }} type="button">Clear filters</button></div>}
      </div>
    </section>

    <section className={styles.assignmentSection} aria-labelledby="assignment-title">
      <div className={styles.sectionHeading}><div><p>REVIEW COVERAGE</p><h2 id="assignment-title">Assignment management</h2></div><span>{assignments.length} assignments</span></div>
      <div className={styles.assignmentContent}>
        <form className={styles.assignmentForm} onSubmit={addAssignment}>
          <div><span className={styles.sectionIndex}>01</span><h3>Assign a project</h3><p>Choose a judge and a project to add a review assignment.</p></div>
          <label><span>Judge</span><select onChange={(event) => setAssignmentJudge(event.target.value)} value={assignmentJudge}><option value="">Select a judge</option>{judges.map((judge) => <option key={judge.id} value={judge.id}>{judge.name} · {judge.status}</option>)}</select></label>
          <label><span>Project</span><select onChange={(event) => setAssignmentProject(event.target.value)} value={assignmentProject}><option value="">Select a project</option>{projects.map((project) => <option key={project.name} value={project.name}>{project.name} · {project.team}</option>)}</select></label>
          <button className={styles.assignButton} type="submit"><Icon name="plus" size={15} /> Add assignment</button>
          {assignmentError && <p className={styles.formError} role="alert">{assignmentError}</p>}
        </form>
        <div className={styles.assignmentList}>
          <div className={styles.assignmentListHeading}><div><p>MANUAL PREVIEW</p><h3>Current assignments</h3></div><span>{assignments.length} total</span></div>
          {assignments.length > 0 ? <ul>{assignments.map((assignment) => {
            const judge = judges.find((candidate) => candidate.id === assignment.judgeId);
            return <li key={assignment.id}><span className={styles.projectGlyph}>{assignment.project.slice(0, 1)}</span><span className={styles.assignmentProject}><strong>{assignment.project}</strong><small>{assignment.team}</small></span><span className={styles.assignedJudge}><small>JUDGE</small><strong>{judge?.name ?? "Unknown judge"}</strong></span><button aria-label={`Remove ${assignment.project} assignment for ${judge?.name ?? "judge"}`} onClick={() => removeAssignment(assignment)} title="Remove assignment" type="button"><Icon name="close" size={15} /></button></li>;
          })}</ul> : <div className={styles.assignmentEmpty}><p>No assignments yet.</p><span>Add a judge and project above to start.</span></div>}
        </div>
      </div>
      <p className={styles.previewNote}><span /> Frontend preview only. Invites and assignments are not sent or saved.</p>
    </section>

    {inviteOpen && <div className={`${styles.modalOverlay} modal-overlay${inviteClosing ? " modal-overlay--closing" : ""}`} onMouseDown={(event) => { if (event.target === event.currentTarget) closeInvite(); }}>
      <section aria-labelledby="invite-title" aria-modal="true" className={`${styles.inviteModal} modal-dialog${inviteClosing ? " modal-dialog--closing" : ""}`} onKeyDown={(event) => { if (event.key === "Escape") closeInvite(); }} role="dialog">
        <header><span className={styles.modalIcon}><Icon name="mail" size={19} /></span><button aria-label="Close invite form" className={styles.modalClose} onClick={closeInvite} type="button"><Icon name="close" size={17} /></button><p>BUILD YOUR REVIEW TEAM</p><h2 id="invite-title">Invite a judge</h2><span>Add a judge to the roster for DOGFOOD Hackathon.</span></header>
        <form onSubmit={inviteJudge}>
          <label><span>Full name</span><input autoComplete="name" maxLength={80} name="name" placeholder="e.g. Alex Morgan" required /></label>
          <label><span>Email address</span><input autoComplete="email" maxLength={254} name="email" placeholder="alex@example.com" required type="email" /></label>
          {inviteError && <p className={styles.formError} role="alert">{inviteError}</p>}
          <div className={styles.modalActions}><button className={styles.cancelButton} onClick={closeInvite} type="button">Cancel</button><button className={styles.primaryButton} type="submit"><Icon name="mail" size={15} /> Add to roster</button></div>
          <p className={styles.modalNote}>Preview only. This will not send an email.</p>
        </form>
      </section>
    </div>}
  </>;
}