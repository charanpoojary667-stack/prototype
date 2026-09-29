"use client";

import { useState, type FormEvent } from "react";
import { apiBody, apiRequest } from "../../../lib/api";
import type { ProjectRecord } from "../project-data";
import styles from "./view.module.css";

type Comment = { id: string; body: string; createdAt: string; author?: { id: string; name: string } };

function Icon({ name, size = 17 }: { name: "arrow" | "check" | "github" | "heart" | "link" | "send" | "users"; size?: number }) {
  const paths = {
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    github: <><path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 6v-3.9a3.4 3.4 0 0 0-.9-2.7c3 0 6.2-1.5 6.2-6.7a5.2 5.2 0 0 0-1.4-3.6 4.8 4.8 0 0 0-.1-3.6s-1.2-.4-3.8 1.4a13.2 13.2 0 0 0-6.9 0C5.5 1.1 4.3 1.5 4.3 1.5a4.8 4.8 0 0 0-.1 3.6 5.2 5.2 0 0 0-1.4 3.6c0 5.2 3.2 6.7 6.2 6.7a3.4 3.4 0 0 0-.9 2.7V22" /></>,
    heart: <path d="M20.8 8.9c0 5.5-8.8 10.2-8.8 10.2S3.2 14.4 3.2 8.9A4.7 4.7 0 0 1 12 6.6a4.7 4.7 0 0 1 8.8 2.3Z" />,
    link: <><path d="M10 13a5 5 0 0 0 7.1 0l3-3A5 5 0 0 0 13 2.9l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.1 0l-3 3A5 5 0 0 0 11 21.1l1.7-1.7" /></>,
    send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
  };

  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function TeamMember({ initials, name, role, tone }: { initials: string; name: string; role: string; tone: string }) {
  return <div className={styles.member}><span className={`${styles.memberAvatar} ${styles[tone]}`}>{initials}</span><span><strong>{name}</strong><small>{role}</small></span></div>;
}

export default function PublicProjectView({ project, comments, voteCount, votingEnabled, hasVoted, onVote, onCommentsChange }: {
  project: ProjectRecord;
  comments: Comment[];
  voteCount: number | null;
  votingEnabled: boolean;
  hasVoted: boolean;
  onVote: () => void;
  onCommentsChange: (comments: Comment[]) => void;
}) {
  const [commentText, setCommentText] = useState("");
  const [feedback, setFeedback] = useState("");
  const [pending, setPending] = useState(false);

  async function vote() {
    setPending(true); setFeedback("");
    try {
      await apiRequest(`/api/projects/${project.id}/vote`, { method: "POST", body: apiBody({}) });
      onVote();
      setFeedback("Your vote has been recorded.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Your vote could not be saved.");
    } finally { setPending(false); }
  }

  async function handleComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = commentText.trim();
    if (!text) return;
    setPending(true); setFeedback("");
    try {
      const result = await apiRequest<{ comment: Comment }>(`/api/projects/${project.id}/comments`, { method: "POST", body: apiBody({ body: text }) });
      onCommentsChange([...comments, result.comment]);
      setCommentText("");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Your comment could not be saved.");
    } finally { setPending(false); }
  }

  return (
    <>
      <header className={styles.projectHero}>
        <div className={styles.heroArtwork} aria-hidden="true"><span>{project.name.slice(0, 1)}</span><i /></div>
        <div className={styles.heroCopy}>
          <div className={styles.heroEyebrow}><span /> DOGFOOD HACKATHON <i /> PUBLIC PROJECT</div>
          <div className={styles.heroTitleRow}><h1>{project.name}</h1><span className={styles.featuredBadge}>FEATURED PROJECT</span></div>
          <p className={styles.heroTagline}>{project.tagline}</p>
          <div className={styles.heroMeta}><span>{project.trackName}</span><i /><span>Updated {project.updatedAt}</span></div>
        </div>
      </header>

      <div className={styles.viewLayout}>
        <div className={styles.primaryColumn}>
          <section className={styles.contentPanel} aria-labelledby="about-title">
            <div className={styles.panelEyebrow}>THE BIG IDEA</div>
            <h2 id="about-title">About this project</h2>
            <p className={styles.description}>{project.description}</p>
          </section>

          <section className={styles.contentPanel} aria-labelledby="comments-title">
            <div className={styles.commentsHeading}><div><div className={styles.panelEyebrow}>JOIN THE CONVERSATION</div><h2 id="comments-title">Community comments</h2></div><span>{comments.length} comments</span></div>
            <form className={styles.commentForm} onSubmit={handleComment}>
              <label className={styles.visuallyHidden} htmlFor="project-comment">Add a comment</label>
              <textarea id="project-comment" maxLength={280} onChange={(event) => setCommentText(event.target.value)} placeholder="Share a thought about this project..." rows={3} value={commentText} />
              <div><span>{commentText.length}/280</span><button disabled={pending || !commentText.trim()} type="submit">Post comment <Icon name="send" size={14} /></button></div>
            </form>
            {feedback && <p role="status">{feedback}</p>}
            <div className={styles.commentList}>
              {comments.map((comment, index) => {
                const name = comment.author?.name || "HackForge member";
                const initials = name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase();
                return <article className={styles.comment} key={comment.id}><span className={`${styles.commentAvatar} ${styles[index % 2 === 0 ? "coralAvatar" : "blueAvatar"]}`}>{initials}</span><div><div className={styles.commentMeta}><strong>{name}</strong><span>{new Date(comment.createdAt).toLocaleString()}</span></div><p>{comment.body}</p></div></article>;
              })}
            </div>
          </section>
        </div>

        <aside className={styles.sidebarColumn}>
          <section className={styles.votePanel} aria-label="Community voting">
            <div className={styles.voteLabel}><Icon name="heart" size={15} /> COMMUNITY VOTE</div>
            <strong>{voteCount === null ? "—" : voteCount}</strong><span>{voteCount === null ? "Vote totals stay hidden while voting is open." : "community votes"}</span>
            {votingEnabled && <button className={hasVoted ? styles.voted : ""} aria-pressed={hasVoted} disabled={hasVoted || pending} onClick={vote} type="button"><Icon name={hasVoted ? "check" : "heart"} size={16} /> {hasVoted ? "Voted" : "Upvote project"}</button>}
            {!votingEnabled && <small>Community voting is closed.</small>}
          </section>

          <section className={styles.infoPanel} aria-labelledby="team-title">
            <div className={styles.panelEyebrow}>BUILT TOGETHER</div><h2 id="team-title">{project.teamName}</h2>
            <div className={styles.memberList}>{project.teamMembers.map((member, index) => <TeamMember key={member.id} {...member} tone={index % 2 === 0 ? "coralAvatar" : "blueAvatar"} />)}</div>
          </section>

          <section className={styles.infoPanel} aria-labelledby="details-title">
            <div className={styles.panelEyebrow}>PROJECT DETAILS</div><h2 id="details-title">Made in the {project.trackName} track</h2>
            <div className={styles.tagList}>{project.technologies.map((technology) => <span key={technology}>{technology}</span>)}</div>
            <div className={styles.projectLinks}>
              <a href={project.repositoryUrl} rel="noreferrer" target="_blank"><Icon name="github" size={15} /> Repository <Icon name="arrow" size={13} /></a>
              <a href={project.demoUrl} rel="noreferrer" target="_blank"><Icon name="link" size={15} /> Live demo <Icon name="arrow" size={13} /></a>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
