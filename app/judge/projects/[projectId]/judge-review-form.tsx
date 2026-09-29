"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { ProjectRecord } from "../../../projects/[projectId]/project-data";
import { apiBody, apiRequest } from "../../../lib/api";
import styles from "./review.module.css";

type Criterion = { id: string; name: string; description: string; weight: number; maxScore: number };
type ReviewStatus = "Draft" | "Submitted";
type ScoreErrors = Record<string, string>;

function Icon({ name, size = 16 }: { name: "arrow" | "check" | "github" | "link" | "send" | "trophy"; size?: number }) {
  const paths = {
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />, check: <path d="m5 12 4 4L19 6" />,
    github: <><path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 6v-3.9a3.4 3.4 0 0 0-.9-2.7c3 0 6.2-1.5 6.2-6.7a5.2 5.2 0 0 0-1.4-3.6 4.8 4.8 0 0 0-.1-3.6s-1.2-.4-3.8 1.4a13.2 13.2 0 0 0-6.9 0C5.5 1.1 4.3 1.5 4.3 1.5a4.8 4.8 0 0 0-.1 3.6 5.2 5.2 0 0 0-1.4 3.6c0 5.2 3.2 6.7 6.2 6.7a3.4 3.4 0 0 0-.9 2.7V22" /></>,
    link: <><path d="M10 13a5 5 0 0 0 7.1 0l3-3A5 5 0 0 0 13 2.9l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.1 0l-3 3A5 5 0 0 0 11 21.1l1.7-1.7" /></>,
    send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
    trophy: <><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 7H4v2a4 4 0 0 0 4 4M17 7h3v2a4 4 0 0 1-4 4" /></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export default function JudgeReviewForm({ project, criteria, existingScores, completed }: { project: ProjectRecord; criteria: Criterion[]; existingScores: { criterionId: string; score: number; feedback?: string }[]; completed: boolean }) {
  const [scores, setScores] = useState<Record<string, string>>(() => Object.fromEntries(existingScores.map(item => [item.criterionId, String(item.score)])));
  const [feedback, setFeedback] = useState("");
  const [errors, setErrors] = useState<ScoreErrors>({});
  const [status, setStatus] = useState<ReviewStatus>(completed ? "Submitted" : existingScores.length ? "Draft" : "Draft");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<"draft" | "submit" | null>(null);
  const scorePreview = useMemo(() => criteria.reduce((total, criterion) => total + (Number(scores[criterion.id]) || 0) * criterion.weight, 0) / 100, [scores]);

  function validate(intent: "draft" | "submit") {
    const nextErrors: ScoreErrors = {};
    criteria.forEach((criterion) => {
      const value = scores[criterion.id]?.trim() ?? "";
      if (!value && intent === "submit") nextErrors[criterion.id] = `Add a score from 1 to ${criterion.maxScore}.`;
      else if (value && (!/^\d+(\.\d+)?$/.test(value) || Number(value) < 0 || Number(value) > criterion.maxScore)) nextErrors[criterion.id] = `Use a score from 0 to ${criterion.maxScore}.`;
    });
    return nextErrors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const intent = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "submit" ? "submit" : "draft";
    const nextErrors = validate(intent);
    setErrors(nextErrors);
    setNotice("");
    if (Object.keys(nextErrors).length > 0) { setNotice("Check the highlighted scores and try again."); return; }
    setPending(intent);
    try {
      await apiRequest(`/api/submissions/${project.id}/scores`, { method: "POST", body: apiBody({ final: intent === "submit", scores: criteria.filter(criterion => scores[criterion.id]?.trim()).map(criterion => ({ criterionId: criterion.id, score: Number(scores[criterion.id]), feedback })) }) });
      setStatus(intent === "submit" ? "Submitted" : "Draft");
      setNotice(intent === "submit" ? "Final review submitted and saved." : "Draft scores saved.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Scores could not be saved."); }
    finally { setPending(null); }
  }

  function updateScore(id: string, value: string) {
    setScores((current) => ({ ...current, [id]: value }));
    setErrors((current) => { const next = { ...current }; delete next[id]; return next; });
    setNotice("");
  }

  return (
    <form className={styles.reviewLayout} noValidate onSubmit={handleSubmit}>
      <div className={styles.primaryColumn}>
        <header className={styles.projectHeader}>
          <div className={styles.projectMark} aria-hidden="true">{project.name.slice(0, 1)}</div>
          <div><p className={styles.eyebrow}><span /> PROJECT REVIEW <i /> {status.toUpperCase()}</p><h1>{project.name}</h1><p>{project.tagline}</p><div className={styles.projectMeta}><span>{project.teamName}</span><i /><span>{project.trackName}</span></div></div>
          <span className={`${styles.reviewStatus} ${status === "Submitted" ? styles.submittedStatus : ""}`}><i /> {status}</span>
        </header>

        <section className={styles.projectInfo} aria-labelledby="project-summary-title"><div className={styles.sectionEyebrow}>PROJECT STORY</div><h2 id="project-summary-title">What the team built</h2><p>{project.description}</p><div className={styles.links}><a href={project.repositoryUrl} rel="noreferrer" target="_blank"><Icon name="github" size={15} /> Repository <Icon name="arrow" size={13} /></a><a href={project.demoUrl} rel="noreferrer" target="_blank"><Icon name="link" size={15} /> Live demo <Icon name="arrow" size={13} /></a></div></section>

        <section className={styles.rubricSection} aria-labelledby="rubric-title"><div className={styles.rubricHeading}><div><div className={styles.sectionEyebrow}>JUDGING RUBRIC</div><h2 id="rubric-title">Score this project</h2></div><span>0–{Math.max(...criteria.map(criterion => criterion.maxScore))} per criterion</span></div><div className={styles.criteriaList}>{criteria.map((criterion, index) => <div className={styles.criterion} key={criterion.id}><div className={styles.criterionNumber}>{String(index + 1).padStart(2, "0")}</div><div className={styles.criterionCopy}><div><h3>{criterion.name}</h3><span>{criterion.weight}% weight</span></div><p>{criterion.description}</p></div><label className={styles.scoreField}><span>Score</span><input aria-describedby={errors[criterion.id] ? `${criterion.id}-error` : undefined} aria-invalid={Boolean(errors[criterion.id])} inputMode="decimal" max={criterion.maxScore} min="0" onChange={(event) => updateScore(criterion.id, event.target.value)} placeholder="—" step="1" type="number" value={scores[criterion.id] ?? ""} />{errors[criterion.id] && <small id={`${criterion.id}-error`}>{errors[criterion.id]}</small>}</label></div>)}</div></section>

        <section className={styles.feedbackSection} aria-labelledby="feedback-title"><div className={styles.sectionEyebrow}>OPTIONAL</div><h2 id="feedback-title">Written feedback</h2><p>Leave a note the team can learn from.</p><textarea maxLength={800} onChange={(event) => setFeedback(event.target.value)} placeholder="What stood out? What could make this project even stronger?" rows={5} value={feedback} /><span>{feedback.length}/800</span></section>
      </div>

      <aside className={styles.sideColumn}>
        <section className={styles.scoreCard} aria-label="Score preview"><div className={styles.scoreCardTop}><span><Icon name="trophy" size={15} /> SCORE PREVIEW</span><span className={styles.previewBadge}>LIVE</span></div><strong>{scorePreview.toFixed(1)}<small>/ 10</small></strong><p>Weighted score preview based on the assigned event rubric.</p><div className={styles.scoreBar}><span style={{ width: `${Math.min(scorePreview * 10, 100)}%` }} /></div><small className={styles.disclaimer}>Your scores are stored with this judging assignment.</small></section>
        <section className={styles.guideCard}><div className={styles.sectionEyebrow}>BEFORE YOU SUBMIT</div><h2>Review with care.</h2><ul><li>Use the full 1–10 range thoughtfully.</li><li>Ground feedback in what you experienced.</li><li>Save a draft if you need to come back.</li></ul></section>
        <div className={styles.actions} aria-live="polite"><button disabled={pending !== null || completed} name="intent" type="submit" value="draft">{pending === "draft" ? "Saving..." : "Save Draft Score"}</button><button className={styles.submitButton} disabled={pending !== null || completed} name="intent" type="submit" value="submit">{pending === "submit" ? "Submitting..." : completed ? "Review submitted" : <>Submit Final Review <Icon name="arrow" size={14} /></>}</button></div>
        {notice && <p className={`${styles.notice} ${Object.keys(errors).length > 0 ? styles.noticeError : ""}`} role={Object.keys(errors).length > 0 ? "alert" : "status"}><Icon name={Object.keys(errors).length > 0 ? "trophy" : "check"} size={14} /> {notice}</p>}
      </aside>
    </form>
  );
}
