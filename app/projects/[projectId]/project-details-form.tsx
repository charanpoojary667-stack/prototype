"use client";

import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { apiBody, apiRequest } from "../../lib/api";
import Link from "next/link";
import type { ProjectMember, ProjectRecord } from "./project-data";
import details from "./details.module.css";
import styles from "../new/project.module.css";

type TrackOption = { id: string; name: string; number: string; tone: string };

type FieldName = "name" | "tagline" | "description" | "track" | "teamMembers" | "repositoryUrl" | "demoUrl";
type FieldErrors = Partial<Record<FieldName, string>>;

function Icon({ name, size = 16 }: { name: "arrow" | "check" | "close" | "github" | "link" | "plus" | "users"; size?: number }) {
  const paths = {
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    github: <><path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 6v-3.9a3.4 3.4 0 0 0-.9-2.7c3 0 6.2-1.5 6.2-6.7a5.2 5.2 0 0 0-1.4-3.6 4.8 4.8 0 0 0-.1-3.6s-1.2-.4-3.8 1.4a13.2 13.2 0 0 0-6.9 0C5.5 1.1 4.3 1.5 4.3 1.5a4.8 4.8 0 0 0-.1 3.6 5.2 5.2 0 0 0-1.4 3.6c0 5.2 3.2 6.7 6.2 6.7a3.4 3.4 0 0 0-.9 2.7V22" /></>,
    link: <><path d="M10 13a5 5 0 0 0 7.1 0l3-3A5 5 0 0 0 13 2.9l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.1 0l-3 3A5 5 0 0 0 11 21.1l1.7-1.7" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
  };

  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

function validateUrl(value: string, label: string) {
  if (!value.trim()) return "";
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? ""
      : `Enter a valid ${label} URL starting with https://.`;
  } catch {
    return `Enter a valid ${label} URL starting with https://.`;
  }
}

function TeamMember({
  member,
  checked,
  onChange,
}: {
  member: ProjectMember;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className={`${details.memberRow} ${checked ? details.memberSelected : ""}`}>
      <input checked={checked} name="teamMember" onChange={onChange} type="checkbox" value={member.id} />
      <span className={`${details.memberAvatar} ${details[`avatar${member.initials}`]}`}>{member.initials}</span>
      <span className={details.memberIdentity}><strong>{member.name}</strong><small>{member.role}</small></span>
      <span className={details.memberCheck}><Icon name="check" size={13} /></span>
    </label>
  );
}

export default function ProjectDetailsForm({ project, eventSlug }: { project: ProjectRecord; eventSlug: string }) {
  const router = useRouter();
  const [tracks, setTracks] = useState<TrackOption[]>([]);
  const [name, setName] = useState(project.name);
  const [tagline, setTagline] = useState(project.tagline);
  const [description, setDescription] = useState(project.description);
  const [trackId, setTrackId] = useState(project.trackId);
  const [repositoryUrl, setRepositoryUrl] = useState(project.repositoryUrl);
  const [demoUrl, setDemoUrl] = useState(project.demoUrl);
  const [technologies, setTechnologies] = useState(project.technologies);
  const [technologyInput, setTechnologyInput] = useState("");
  const [selectedMembers, setSelectedMembers] = useState(project.teamMembers.map((member) => member.id));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [feedback, setFeedback] = useState("");
  const [feedbackKind, setFeedbackKind] = useState<"success" | "error">("success");
  const [pendingIntent, setPendingIntent] = useState<"draft" | "submit" | null>(null);

  useEffect(() => {
    apiRequest<{ event: { tracks: { id: string; name: string }[] } }>(`/api/events/${encodeURIComponent(eventSlug)}`)
      .then(({ event }) => setTracks(event.tracks.map((track, index) => ({ id: track.id, name: track.name, number: String(index + 1).padStart(2, "0"), tone: (["green", "coral", "blue"] as const)[index % 3] }))))
      .catch(() => setTracks([]));
  }, [eventSlug]);

  const checklistItems = [
    { label: "Project details", complete: Boolean(name.trim() && tagline.trim() && description.trim() && trackId) },
    { label: "Team selected", complete: selectedMembers.length > 0 },
    { label: "Repository linked", complete: Boolean(repositoryUrl.trim()) },
    { label: "Demo link added", complete: Boolean(demoUrl.trim()) },
    { label: "Technologies added", complete: technologies.length > 0 },
  ];
  const completedChecklistItems = checklistItems.filter((item) => item.complete).length;

  function clearError(field: FieldName) {
    setErrors((currentErrors) => {
      if (!currentErrors[field]) return currentErrors;
      const nextErrors = { ...currentErrors };
      delete nextErrors[field];
      return nextErrors;
    });
    setFeedback("");
  }

  function addTechnology() {
    const value = technologyInput.trim().replace(/,$/, "");
    if (value && !technologies.some((technology) => technology.toLowerCase() === value.toLowerCase())) {
      setTechnologies((current) => [...current, value]);
    }
    setTechnologyInput("");
  }

  function handleTechnologyKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTechnology();
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter as HTMLButtonElement | null);
    const intent = formData.get("intent") === "submit" ? "submit" : "draft";
    const nextErrors: FieldErrors = {};
    const nextName = String(formData.get("name") ?? "").trim();
    const nextTagline = String(formData.get("tagline") ?? "").trim();
    const nextDescription = String(formData.get("description") ?? "").trim();
    const nextRepository = String(formData.get("repositoryUrl") ?? "");
    const nextDemo = String(formData.get("demoUrl") ?? "");

    if (!nextName) nextErrors.name = "Add a project name before saving.";
    if (intent === "submit") {
      if (!nextTagline) nextErrors.tagline = "Add a short tagline before submitting.";
      if (!nextDescription) nextErrors.description = "Add a description before submitting.";
      if (!trackId) nextErrors.track = "Choose a track before submitting.";
      if (selectedMembers.length === 0) nextErrors.teamMembers = "Choose at least one team member.";
    }
    const repositoryError = validateUrl(nextRepository, "GitHub repository");
    const demoError = validateUrl(nextDemo, "demo");
    if (repositoryError) nextErrors.repositoryUrl = repositoryError;
    if (demoError) nextErrors.demoUrl = demoError;

    setErrors(nextErrors);
    setFeedback("");
    if (Object.keys(nextErrors).length > 0) {
      setFeedback("Check the highlighted fields and try again.");
      setFeedbackKind("error");
      return;
    }

    setPendingIntent(intent);
    try {
      await apiRequest(`/api/projects/${project.id}`, { method: "PATCH", body: apiBody({
        title: nextName, tagline: nextTagline, summary: nextDescription, trackId,
        repositoryUrl: nextRepository, demoUrl: nextDemo, tags: technologies,
      }) });
      if (intent === "submit") {
        await apiRequest(`/api/projects/${project.id}/submit`, { method: "POST", body: apiBody({}) });
        router.push(`/projects/${project.id}/submission`);
        router.refresh();
      } else {
        setFeedback(`${nextName} draft saved.`);
        setFeedbackKind("success");
      }
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Project changes could not be saved.");
      setFeedbackKind("error");
    } finally {
      setPendingIntent(null);
    }
  }

  function toggleMember(memberId: string) {
    setSelectedMembers((current) => current.includes(memberId)
      ? current.filter((id) => id !== memberId)
      : [...current, memberId]);
    clearError("teamMembers");
  }

  return (
    <form aria-busy={pendingIntent !== null} className={styles.projectLayout} noValidate onSubmit={handleSubmit}>
      <div className={styles.formColumn}>
        <section className={styles.formSection} aria-labelledby="details-basics-title">
          <div className={styles.sectionHeading}>
            <span className={styles.sectionNumber}>01</span>
            <div><p>THE BIG IDEA</p><h2 id="details-basics-title">Project details</h2></div>
          </div>
          <div className={styles.fieldsGrid}>
            <label className={`${styles.field} ${styles.fieldWide}`}>
              <span className={styles.fieldLabel}>Project name <i>Required</i></span>
              <input aria-describedby={errors.name ? "edit-name-error" : undefined} aria-invalid={Boolean(errors.name)} maxLength={60} name="name" onChange={(event) => { setName(event.target.value); clearError("name"); }} value={name} />
              {errors.name && <span className={styles.fieldError} id="edit-name-error">{errors.name}</span>}
            </label>
            <label className={`${styles.field} ${styles.fieldWide}`}>
              <span className={styles.fieldLabel}>Short tagline <i>Required</i></span>
              <input aria-describedby={errors.tagline ? "edit-tagline-error" : undefined} aria-invalid={Boolean(errors.tagline)} maxLength={100} name="tagline" onChange={(event) => { setTagline(event.target.value); clearError("tagline"); }} value={tagline} />
              {errors.tagline && <span className={styles.fieldError} id="edit-tagline-error">{errors.tagline}</span>}
            </label>
            <label className={`${styles.field} ${styles.fieldWide}`}>
              <span className={styles.fieldLabel}>Project description <i>Required</i></span>
              <textarea aria-describedby={errors.description ? "edit-description-error" : "edit-description-hint"} aria-invalid={Boolean(errors.description)} maxLength={800} name="description" onChange={(event) => { setDescription(event.target.value); clearError("description"); }} rows={5} value={description} />
              <span className={errors.description ? styles.fieldError : styles.fieldHint} id={errors.description ? "edit-description-error" : "edit-description-hint"}>
                {errors.description ?? `${description.length}/800 characters`}
              </span>
            </label>
          </div>
        </section>

        <section className={styles.formSection} aria-labelledby="details-track-title">
          <div className={styles.sectionHeading}>
            <span className={styles.sectionNumber}>02</span>
            <div><p>FIND YOUR LANE</p><h2 id="details-track-title">Project track <i>Required</i></h2></div>
          </div>
          <div className={styles.trackOptions} role="radiogroup" aria-labelledby="details-track-title" aria-describedby={errors.track ? "edit-track-error" : undefined}>
            {tracks.map((track) => (
              <label className={`${styles.trackOption} ${trackId === track.id ? styles.trackOptionSelected : ""}`} key={track.id}>
                <input checked={trackId === track.id} name="track" onChange={() => { setTrackId(track.id); clearError("track"); }} type="radio" value={track.id} />
                <span className={`${styles.trackMark} ${styles[`trackMark${track.tone}`]}`}>{track.number}</span>
                <span className={styles.trackCopy}><strong>{track.name}</strong></span>
                <span className={styles.radioMark} aria-hidden="true" />
              </label>
            ))}
          </div>
          {errors.track && <p className={styles.fieldError} id="edit-track-error">{errors.track}</p>}
        </section>

        <section className={styles.formSection} aria-labelledby="details-team-title">
          <div className={styles.sectionHeading}>
            <span className={styles.sectionNumber}>03</span>
            <div><p>BUILD TOGETHER</p><h2 id="details-team-title">Team members</h2></div>
          </div>
          <fieldset className={details.teamFieldset} aria-describedby={errors.teamMembers ? "members-error" : "members-hint"}>
            <legend className={details.visuallyHidden}>Choose which team members are contributing</legend>
            <div className={details.teamHeading}>
              <span><Icon name="users" size={15} /> {project.teamName}</span>
              <span>{selectedMembers.length} selected</span>
            </div>
            <div className={details.memberList}>
              {project.teamMembers.map((member) => (
                <TeamMember key={member.id} member={member} checked={selectedMembers.includes(member.id)} onChange={() => toggleMember(member.id)} />
              ))}
            </div>
            <span className={errors.teamMembers ? styles.fieldError : styles.fieldHint} id={errors.teamMembers ? "members-error" : "members-hint"}>
              {errors.teamMembers ?? "Select the teammates who contributed to this project."}
            </span>
          </fieldset>
        </section>

        <section className={styles.formSection} aria-labelledby="details-links-title">
          <div className={styles.sectionHeading}>
            <span className={styles.sectionNumber}>04</span>
            <div><p>SHOW YOUR WORK</p><h2 id="details-links-title">Links & technologies</h2></div>
          </div>
          <div className={styles.fieldsGrid}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}><span><Icon name="github" size={15} /> GitHub repository</span><i>Optional</i></span>
              <input aria-describedby={errors.repositoryUrl ? "repository-error" : "repository-hint"} aria-invalid={Boolean(errors.repositoryUrl)} autoComplete="url" inputMode="url" name="repositoryUrl" onChange={(event) => { setRepositoryUrl(event.target.value); clearError("repositoryUrl"); }} placeholder="https://github.com/team/project" type="url" value={repositoryUrl} />
              <span className={errors.repositoryUrl ? styles.fieldError : styles.fieldHint} id={errors.repositoryUrl ? "repository-error" : "repository-hint"}>
                {errors.repositoryUrl ?? "Link to the source code."}
              </span>
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}><span><Icon name="link" size={15} /> Demo URL</span><i>Optional</i></span>
              <input aria-describedby={errors.demoUrl ? "edit-demo-error" : "edit-demo-hint"} aria-invalid={Boolean(errors.demoUrl)} autoComplete="url" inputMode="url" name="demoUrl" onChange={(event) => { setDemoUrl(event.target.value); clearError("demoUrl"); }} placeholder="https://your-demo.com" type="url" value={demoUrl} />
              <span className={errors.demoUrl ? styles.fieldError : styles.fieldHint} id={errors.demoUrl ? "edit-demo-error" : "edit-demo-hint"}>
                {errors.demoUrl ?? "A live demo or prototype."}
              </span>
            </label>
            <div className={`${styles.field} ${styles.fieldWide}`}>
              <label className={styles.fieldLabel} htmlFor="edit-technologies">Technologies & tags <i>Optional</i></label>
              <div className={styles.tagEditor}>
                {technologies.map((technology) => (
                  <span className={styles.tagChip} key={technology}>
                    {technology}
                    <button aria-label={`Remove ${technology}`} onClick={() => setTechnologies((current) => current.filter((item) => item !== technology))} type="button"><Icon name="close" size={13} /></button>
                  </span>
                ))}
                <input autoComplete="off" id="edit-technologies" onChange={(event) => setTechnologyInput(event.target.value)} onKeyDown={handleTechnologyKeyDown} placeholder="Add a technology" value={technologyInput} />
                <button className={styles.addTagButton} onClick={addTechnology} type="button" aria-label="Add technology"><Icon name="plus" size={16} /></button>
              </div>
              <span className={styles.fieldHint}>Press Enter or comma to add a technology or tag.</span>
            </div>
          </div>
        </section>

        <div className={styles.formActions}>
          <Link className={styles.cancelLink} href="/">Cancel</Link>
          <div aria-live="polite">
            <button className={styles.draftButton} disabled={pendingIntent !== null} name="intent" type="submit" value="draft">
              {pendingIntent === "draft" ? "Saving draft…" : "Save Draft"}
            </button>
            <button className={styles.createButton} disabled={pendingIntent !== null} name="intent" type="submit" value="submit">
              {pendingIntent === "submit" ? "Preparing…" : <>Submit Project <Icon name="arrow" size={15} /></>}
            </button>
          </div>
        </div>
        {feedback && (
          <p className={`${styles.feedback} ${feedbackKind === "error" ? styles.feedbackError : styles.feedbackSuccess}`} role={feedbackKind === "error" ? "alert" : "status"}>
            <Icon name={feedbackKind === "error" ? "close" : "check"} size={16} /> {feedback}
          </p>
        )}
      </div>

      <aside className={styles.projectAside} aria-label="Project summary">
        <section className={styles.previewPanel} aria-labelledby="project-preview-title">
          <div className={styles.asideHeading}><span>PROJECT PREVIEW</span><span className={details.previewDot} /></div>
          <div className={details.previewArtwork}>
            <span className={details.previewStamp}>{name.trim().slice(0, 1).toUpperCase() || "P"}</span>
            <span className={details.previewEdition}>DOGFOOD / FALL 2026</span>
            <span className={details.previewTrack}>{tracks.find((track) => track.id === trackId)?.name}</span>
          </div>
          <div className={styles.previewContent}>
            <h2 id="project-preview-title">{name.trim() || "Your project name"}</h2>
            <p>{tagline.trim() || "Your project tagline will appear here."}</p>
            <span className={styles.previewDivider} />
            <p className={styles.previewDescription}>{description.trim() || "Add a description to introduce your project."}</p>
            <div className={styles.previewTags}>{technologies.slice(0, 4).map((technology) => <span key={technology}>{technology}</span>)}</div>
          </div>
        </section>

        <section className={styles.teamPanel} aria-labelledby="submission-title">
          <div className={styles.teamPanelHeading}><span className={styles.teamIcon}><Icon name="check" size={16} /></span><span>SUBMISSION CHECKLIST</span><span className={styles.teamStatus}>{completedChecklistItems} / {checklistItems.length}</span></div>
          <h2 id="submission-title">A strong project story</h2>
          <div className={details.checklist}>
            {checklistItems.map((item) => (
              <span className={item.complete ? "" : details.checklistPending} key={item.label}>
                <i>{item.complete && <Icon name="check" size={11} />}</i> {item.label}
              </span>
            ))}
          </div>
          <Link href={`/teams/demo-team?eventId=${encodeURIComponent(eventSlug)}`} className={styles.teamLink}>View your team <Icon name="arrow" size={14} /></Link>
        </section>
        <p className={styles.previewNote}><span /> Changes are saved to your team’s local event project.</p>
      </aside>
    </form>
  );
}
