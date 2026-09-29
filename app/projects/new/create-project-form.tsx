"use client";

import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiBody, apiRequest } from "../../lib/api";
import styles from "./project.module.css";

type TrackOption = { id: string; number: string; name: string; detail: string; color: string };
type TeamSummary = { id: string; name: string; memberIds: string[]; members: { id: string; name: string }[] };

type FieldName = "name" | "tagline" | "description" | "track" | "githubUrl" | "demoUrl";
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

export default function CreateProjectForm({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [eventTitle, setEventTitle] = useState("DOGFOOD HACKATHON");
  const [tracks, setTracks] = useState<TrackOption[]>([]);
  const [team, setTeam] = useState<TeamSummary | null>(null);
  const [projectName, setProjectName] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTrack, setSelectedTrack] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [feedback, setFeedback] = useState("");
  const [feedbackKind, setFeedbackKind] = useState<"success" | "error">("success");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    Promise.all([apiRequest<{ event: { title: string; tracks: { id: string; name: string; description: string }[] } }>(`/api/events/${encodeURIComponent(eventId)}`), apiRequest<{ teams: TeamSummary[] }>(`/api/teams?eventId=${encodeURIComponent(eventId)}`)])
      .then(([result, teamResult]) => {
        setEventTitle(result.event.title);
        setTracks(result.event.tracks.map((track, index) => ({ id: track.id, number: String(index + 1).padStart(2, "0"), name: track.name, detail: track.description, color: (["green", "coral", "blue"] as const)[index % 3] })));
        setTeam(teamResult.teams[0] || null);
      })
      .catch((error: unknown) => setFeedback(error instanceof Error ? error.message : "Event or team data could not be loaded."));
  }, [eventId]);

  function addTag() {
    const nextTag = tagInput.trim().replace(/,$/, "");
    if (nextTag && !tags.some((tag) => tag.toLowerCase() === nextTag.toLowerCase())) {
      setTags((currentTags) => [...currentTags, nextTag]);
    }
    setTagInput("");
  }

  function handleTagKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag();
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter as HTMLButtonElement | null);
    const intent = formData.get("intent");
    const nextErrors: FieldErrors = {};
    const name = String(formData.get("name") ?? "").trim();
    const nextTagline = String(formData.get("tagline") ?? "").trim();
    const nextDescription = String(formData.get("description") ?? "").trim();
    const githubUrl = String(formData.get("githubUrl") ?? "");
    const demoUrl = String(formData.get("demoUrl") ?? "");

    if (!name) nextErrors.name = "Add a project name to continue.";
    if (intent === "create") {
      if (!nextTagline) nextErrors.tagline = "Add a short tagline for your project.";
      if (!nextDescription) nextErrors.description = "Tell people what your project does.";
      if (!selectedTrack) nextErrors.track = "Choose the track that best fits your project.";
    }
    const githubError = validateUrl(githubUrl, "GitHub repository");
    const demoError = validateUrl(demoUrl, "demo");
    if (githubError) nextErrors.githubUrl = githubError;
    if (demoError) nextErrors.demoUrl = demoError;

    setErrors(nextErrors);
    setFeedback("");

    if (Object.keys(nextErrors).length > 0) {
      setFeedback("Check the highlighted fields and try again.");
      setFeedbackKind("error");
      return;
    }

    setPending(true);
    try {
      const result = await apiRequest<{ project: { id: string } }>("/api/projects", { method: "POST", body: apiBody({
        eventId, title: name, tagline: nextTagline, summary: nextDescription,
        trackId: selectedTrack || null, tags, repositoryUrl: githubUrl, demoUrl,
      }) });
      if (intent === "create") await apiRequest(`/api/projects/${result.project.id}/submit`, { method: "POST", body: apiBody({}) });
      router.push(intent === "create" ? `/projects/${result.project.id}/submission` : `/projects/${result.project.id}`);
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "The project could not be saved.");
      setFeedbackKind("error");
    } finally { setPending(false); }
  }

  function clearError(field: FieldName) {
    setErrors((currentErrors) => {
      if (!currentErrors[field]) return currentErrors;
      const nextErrors = { ...currentErrors };
      delete nextErrors[field];
      return nextErrors;
    });
    setFeedback("");
  }

  return (
    <form className={styles.projectLayout} noValidate onSubmit={handleSubmit}>
      <div className={styles.formColumn}>
        <section className={styles.formSection} aria-labelledby="basics-title">
          <div className={styles.sectionHeading}>
            <span className={styles.sectionNumber}>01</span>
            <div><p>THE BIG IDEA</p><h2 id="basics-title">Project basics</h2></div>
          </div>
          <div className={styles.fieldsGrid}>
            <label className={`${styles.field} ${styles.fieldWide}`}>
              <span className={styles.fieldLabel}>Project name <i>Required</i></span>
              <input
                aria-describedby={errors.name ? "name-error" : "name-hint"}
                aria-invalid={Boolean(errors.name)}
                autoComplete="off"
                maxLength={60}
                name="name"
                onChange={(event) => { setProjectName(event.target.value); clearError("name"); }}
                placeholder="e.g. CivicSignal"
                value={projectName}
              />
              <span className={errors.name ? styles.fieldError : styles.fieldHint} id={errors.name ? "name-error" : "name-hint"}>
                {errors.name ?? "Choose a name people will remember."}
              </span>
            </label>
            <label className={`${styles.field} ${styles.fieldWide}`}>
              <span className={styles.fieldLabel}>Short tagline <i>Required</i></span>
              <input
                aria-describedby={errors.tagline ? "tagline-error" : undefined}
                aria-invalid={Boolean(errors.tagline)}
                maxLength={100}
                name="tagline"
                onChange={(event) => { setTagline(event.target.value); clearError("tagline"); }}
                placeholder="The one-line version of your idea"
                value={tagline}
              />
              {errors.tagline && <span className={styles.fieldError} id="tagline-error">{errors.tagline}</span>}
            </label>
            <label className={`${styles.field} ${styles.fieldWide}`}>
              <span className={styles.fieldLabel}>Project description <i>Required</i></span>
              <textarea
                aria-describedby={errors.description ? "description-error" : "description-hint"}
                aria-invalid={Boolean(errors.description)}
                maxLength={800}
                name="description"
                onChange={(event) => { setDescription(event.target.value); clearError("description"); }}
                placeholder="What are you building, who is it for, and what makes it useful?"
                rows={5}
                value={description}
              />
              <span className={errors.description ? styles.fieldError : styles.fieldHint} id={errors.description ? "description-error" : "description-hint"}>
                {errors.description ?? `${description.length}/800 characters`}
              </span>
            </label>
          </div>
        </section>

        <section className={styles.formSection} aria-labelledby="track-title">
          <div className={styles.sectionHeading}>
            <span className={styles.sectionNumber}>02</span>
            <div><p>FIND YOUR LANE</p><h2 id="track-title">Choose a track <i>Required</i></h2></div>
          </div>
          <div className={styles.trackOptions} role="radiogroup" aria-labelledby="track-title" aria-describedby={errors.track ? "track-error" : undefined}>
            {tracks.map((track) => (
              <label className={`${styles.trackOption} ${selectedTrack === track.id ? styles.trackOptionSelected : ""}`} key={track.id}>
                <input
                  checked={selectedTrack === track.id}
                  name="track"
                  onChange={() => { setSelectedTrack(track.id); clearError("track"); }}
                  type="radio"
                  value={track.id}
                />
                <span className={`${styles.trackMark} ${styles[`trackMark${track.color}`]}`}>{track.number}</span>
                <span className={styles.trackCopy}><strong>{track.name}</strong><small>{track.detail}</small></span>
                <span className={styles.radioMark} aria-hidden="true" />
              </label>
            ))}
          </div>
          {errors.track && <p className={styles.fieldError} id="track-error">{errors.track}</p>}
        </section>

        <section className={styles.formSection} aria-labelledby="links-title">
          <div className={styles.sectionHeading}>
            <span className={styles.sectionNumber}>03</span>
            <div><p>SHOW YOUR WORK</p><h2 id="links-title">Links & technology</h2></div>
          </div>
          <div className={styles.fieldsGrid}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}><span><Icon name="github" size={15} /> GitHub repository</span><i>Optional</i></span>
              <input
                aria-describedby={errors.githubUrl ? "github-error" : "github-hint"}
                aria-invalid={Boolean(errors.githubUrl)}
                autoComplete="url"
                inputMode="url"
                name="githubUrl"
                onChange={() => clearError("githubUrl")}
                placeholder="https://github.com/team/project"
                type="url"
              />
              <span className={errors.githubUrl ? styles.fieldError : styles.fieldHint} id={errors.githubUrl ? "github-error" : "github-hint"}>
                {errors.githubUrl ?? "Link to your code when it’s ready."}
              </span>
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}><span><Icon name="link" size={15} /> Demo URL</span><i>Optional</i></span>
              <input
                aria-describedby={errors.demoUrl ? "demo-error" : "demo-hint"}
                aria-invalid={Boolean(errors.demoUrl)}
                autoComplete="url"
                inputMode="url"
                name="demoUrl"
                onChange={() => clearError("demoUrl")}
                placeholder="https://your-demo.com"
                type="url"
              />
              <span className={errors.demoUrl ? styles.fieldError : styles.fieldHint} id={errors.demoUrl ? "demo-error" : "demo-hint"}>
                {errors.demoUrl ?? "A live demo or prototype link."}
              </span>
            </label>
            <div className={`${styles.field} ${styles.fieldWide}`}>
              <label className={styles.fieldLabel} htmlFor="project-tags">Technology & tags <i>Optional</i></label>
              <div className={styles.tagEditor}>
                {tags.map((tag) => (
                  <span className={styles.tagChip} key={tag}>
                    {tag}
                    <button aria-label={`Remove ${tag} tag`} onClick={() => setTags((currentTags) => currentTags.filter((currentTag) => currentTag !== tag))} type="button"><Icon name="close" size={13} /></button>
                  </span>
                ))}
                <input
                  autoComplete="off"
                  id="project-tags"
                  onChange={(event) => setTagInput(event.target.value)}
                  onKeyDown={handleTagKeyDown}
                  placeholder={tags.length ? "Add another" : "e.g. React, climate, open data"}
                  value={tagInput}
                />
                <button className={styles.addTagButton} onClick={addTag} type="button" aria-label="Add technology tag"><Icon name="plus" size={16} /></button>
              </div>
              <span className={styles.fieldHint}>Press Enter or comma to add a tag.</span>
            </div>
          </div>
        </section>

        <div className={styles.formActions}>
          <Link className={styles.cancelLink} href="/">Cancel</Link>
          <div>
            <button className={styles.draftButton} disabled={pending} name="intent" type="submit" value="draft">{pending ? "Saving…" : "Save as Draft"}</button>
            <button className={styles.createButton} disabled={pending} name="intent" type="submit" value="create">{pending ? "Submitting…" : "Create Project"} {!pending && <Icon name="arrow" size={15} />}</button>
          </div>
        </div>
        {feedback && (
          <p className={`${styles.feedback} ${feedbackKind === "error" ? styles.feedbackError : styles.feedbackSuccess}`} role={feedbackKind === "error" ? "alert" : "status"}>
            <Icon name={feedbackKind === "error" ? "close" : "check"} size={16} /> {feedback}
          </p>
        )}
      </div>

      <aside className={styles.projectAside} aria-label="Project preview and team summary">
        <section className={styles.previewPanel} aria-labelledby="preview-title">
          <div className={styles.asideHeading}><span>LIVE PREVIEW</span><span className={styles.previewPulse} /></div>
          <div className={styles.previewArtwork}>
            <span className={styles.artworkStamp}>HF<br />26</span>
            <span className={styles.artworkLabel}>{eventTitle} / PROJECT</span>
            <span className={styles.artworkShape} aria-hidden="true" />
          </div>
          <div className={styles.previewContent}>
            <span className={styles.previewTrack}>{tracks.find((track) => track.id === selectedTrack)?.name ?? "Select a track"}</span>
            <h2 id="preview-title">{projectName.trim() || "Your project name"}</h2>
            <p>{tagline.trim() || "Your one-line idea goes here."}</p>
            <span className={styles.previewDivider} />
            <p className={styles.previewDescription}>{description.trim() || "A short introduction to your project will appear here."}</p>
            {tags.length > 0 && <div className={styles.previewTags}>{tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}</div>}
          </div>
        </section>

        <section className={styles.teamPanel} aria-labelledby="team-summary-title">
          <div className={styles.teamPanelHeading}><span className={styles.teamIcon}><Icon name="users" size={17} /></span><span>YOUR TEAM</span><span className={styles.teamStatus}>READY</span></div>
          <h2 id="team-summary-title">{team?.name || "No event team found"}</h2>
          <p>{team ? "Building for DOGFOOD Hackathon" : "Register and join or create a team before starting a project."}</p>
          <div className={styles.teamMembers}>
            {team?.members.slice(0, 3).map((member, index) => <span className={`${styles.memberAvatar} ${[styles.avatarJordan, styles.avatarMaya, styles.avatarAlex][index]}`} key={member.id}>{member.name.split(/\s+/).map(part => part[0]).join("").slice(0, 2)}</span>)}
            {team && team.members.length > 3 && <span className={styles.memberMore}>+{team.members.length - 3}</span>}
            <span className={styles.memberCount}>{team?.memberIds.length || 0} <i>/ 5 members</i></span>
          </div>
          <Link href={`/teams/demo-team?eventId=${encodeURIComponent(eventId)}`} className={styles.teamLink}>View team <Icon name="arrow" size={14} /></Link>
        </section>

        <p className={styles.previewNote}><span /> Drafts and submissions are saved to the local event database.</p>
      </aside>
    </form>
  );
}
