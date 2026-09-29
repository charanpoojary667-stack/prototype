"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ProjectRecord } from "../project-data";
import { apiBody, apiRequest } from "../../../lib/api";
import styles from "./submission.module.css";

function Icon({ name, size = 16 }: { name: "arrow" | "calendar" | "check" | "close" | "link" | "lock" | "spark"; size?: number }) {
  const paths = {
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />, calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>, check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M18 6 6 18" />, link: <><path d="M10 13a5 5 0 0 0 7.1 0l3-3A5 5 0 0 0 13 2.9l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.1 0l-3 3A5 5 0 0 0 11 21.1l1.7-1.7" /></>, lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>, spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2L12 3Z" /><path d="m19 14 1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2L19 14Z" /></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export default function SubmissionPanel({ project, initialStatus, deadline }: { project: ProjectRecord; initialStatus: string; deadline: string }) {
  const [submitted, setSubmitted] = useState(initialStatus === "SUBMITTED");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmClosing, setConfirmClosing] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(0);
  useEffect(() => {
    const initialTick = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { window.clearTimeout(initialTick); window.clearInterval(timer); };
  }, []);
  const deadlinePassed = now > 0 && now > Date.parse(deadline);

  function closeConfirmation() {
    if (confirmClosing) return;
    setConfirmClosing(true);
    const closeDelay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 160;
    window.setTimeout(() => {
      setConfirmOpen(false);
      setConfirmClosing(false);
    }, closeDelay);
  }

  async function saveDraft() {
    setPending(true);
    try { await apiRequest(`/api/projects/${project.id}`, { method: "PATCH", body: apiBody({ title: project.name, tagline: project.tagline, summary: project.description, trackId: project.trackId, tags: project.technologies, repositoryUrl: project.repositoryUrl === "#" ? "" : project.repositoryUrl, demoUrl: project.demoUrl === "#" ? "" : project.demoUrl }) }); setNotice("Draft saved."); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Draft could not be saved."); }
    finally { setPending(false); }
  }

  async function confirmSubmission() {
    setPending(true);
    try { await apiRequest(`/api/projects/${project.id}/submit`, { method: "POST", body: apiBody({}) }); setSubmitted(true); closeConfirmation(); setNotice("Submitted successfully. Your project is now locked for editing."); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Project could not be submitted."); }
    finally { setPending(false); }
  }

  return <>
    <header className={styles.pageHeader}><div><p className={styles.eyebrow}><span /> DOGFOOD HACKATHON <i /> SUBMISSION STATUS</p><h1>{submitted ? "Your project is submitted." : `Ready to submit ${project.name}?`}</h1><p>{submitted ? "The team’s work has been sent to the hackathon showcase." : "Review the final details before sending your project to the showcase."}</p></div><span className={`${styles.statusBadge} ${submitted ? styles.statusSubmitted : ""}`}><i /> {submitted ? "SUBMITTED" : "DRAFT"}</span></header>

    {submitted && <section className={styles.successState} aria-live="polite"><span><Icon name="check" size={23} /></span><div><p>SUBMISSION COMPLETE</p><h2>Submitted successfully</h2><small>Your project is published to the event gallery.</small></div><Link href={`/projects/${project.id}/view`}>View project <Icon name="arrow" size={14} /></Link></section>}
    {deadlinePassed && !submitted && <div className={styles.deadlineWarning} role="alert"><Icon name="calendar" size={17} /><div><strong>The submission deadline has passed.</strong><span>The event is no longer accepting submissions.</span></div></div>}

    <div className={styles.statusLayout}>
      <div className={styles.primaryColumn}>
        <section className={styles.progressCard} aria-labelledby="progress-title"><div className={styles.cardHeading}><div><p className={styles.sectionEyebrow}>SUBMISSION PROGRESS</p><h2 id="progress-title">Project profile</h2></div><strong>{submitted ? "100%" : "80%"}</strong></div><div className={styles.progressTrack}><span style={{ width: submitted ? "100%" : "80%" }} /></div><div className={styles.progressSteps}><span className={styles.complete}><i><Icon name="check" size={11} /></i> Details</span><span className={styles.complete}><i><Icon name="check" size={11} /></i> Team</span><span className={styles.complete}><i><Icon name="check" size={11} /></i> Links</span><span className={submitted ? styles.complete : styles.current}><i>{submitted ? <Icon name="check" size={11} /> : "4"}</i> Submit</span></div></section>
        <section className={styles.summaryCard} aria-labelledby="summary-title"><div className={styles.cardHeading}><div><p className={styles.sectionEyebrow}>PROJECT DETAILS</p><h2 id="summary-title">{project.name}</h2></div><span className={styles.teamPill}>{project.teamName}</span></div><p className={styles.tagline}>{project.tagline}</p><p className={styles.description}>{project.description}</p><div className={styles.detailRows}><div><span>TRACK</span><strong>{project.trackName}</strong></div><div><span>TECHNOLOGIES</span><div className={styles.tags}>{project.technologies.map((technology) => <span key={technology}>{technology}</span>)}</div></div><div><span>LAST SAVED</span><strong>{project.updatedAt} · 4:18 PM</strong></div></div><div className={styles.links}><a href={project.repositoryUrl} rel="noreferrer" target="_blank"><Icon name="link" size={14} /> Repository <Icon name="arrow" size={13} /></a><a href={project.demoUrl} rel="noreferrer" target="_blank"><Icon name="spark" size={14} /> Live demo <Icon name="arrow" size={13} /></a></div></section>
      </div>
      <aside className={styles.sideColumn}>
        <section className={styles.deadlineCard}><div className={styles.deadlineIcon}><Icon name="calendar" size={17} /></div><p className={styles.sectionEyebrow}>SUBMISSION DEADLINE</p><strong>October 11, 2026</strong><span>6:00 PM UTC</span>{deadlinePassed ? <small className={styles.warningText}>Deadline passed</small> : <small className={styles.openText}>Submission window open</small>}</section>
        <section className={styles.teamCard}><p className={styles.sectionEyebrow}>YOUR TEAM</p><h2>{project.teamName}</h2><div className={styles.memberStack}>{project.teamMembers.map((member, index) => <span className={`${styles.memberAvatar} ${index % 2 ? styles.avatarBlue : styles.avatarCoral}`} key={member.id}>{member.initials}</span>)}</div><small>{project.teamMembers.length} contributors on this submission</small></section>
        <div className={styles.actions}>{!submitted && <><Link className={styles.editButton} href={`/projects/${project.id}`}><Icon name="spark" size={14} /> Edit Project</Link><button className={styles.saveButton} disabled={pending} onClick={saveDraft} type="button">Save Draft</button><button className={styles.submitButton} disabled={pending || deadlinePassed} onClick={() => setConfirmOpen(true)} type="button">Submit Project <Icon name="arrow" size={14} /></button></>}{submitted && <button className={styles.lockedButton} disabled type="button"><Icon name="lock" size={14} /> Editing disabled</button>}</div>
        {notice && <p className={styles.notice} role="status"><Icon name={submitted ? "check" : "spark"} size={14} /> {notice}</p>}
      </aside>
    </div>

    {confirmOpen && <div className={`${styles.modalBackdrop} modal-overlay${confirmClosing ? " modal-overlay--closing" : ""}`} role="presentation"><section aria-labelledby="confirm-title" aria-modal="true" className={`${styles.confirmModal} modal-dialog${confirmClosing ? " modal-dialog--closing" : ""}`} role="dialog"><button aria-label="Close submission confirmation" className={styles.closeButton} onClick={closeConfirmation} type="button"><Icon name="close" size={16} /></button><span className={styles.modalIcon}><Icon name="spark" size={21} /></span><p className={styles.sectionEyebrow}>FINAL CHECK</p><h2 id="confirm-title">Submit {project.name}?</h2><p>Once submitted, your project will be locked for this preview and marked ready for judging.</p><div><button className={styles.cancelButton} onClick={closeConfirmation} type="button">Go back</button><button className={styles.confirmButton} disabled={pending} onClick={confirmSubmission} type="button">{pending ? "Submitting..." : "Yes, submit project"} <Icon name="arrow" size={14} /></button></div></section></div>}
  </>;
}
