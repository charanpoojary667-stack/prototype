"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "../lib/api";
import styles from "./results.module.css";

type Entry = { rank: number; score: number | null; prize?: { name?: string; value?: string } | null; team?: { name: string }; submission?: { id: string; title: string; track: string } | null };

export default function ResultsLive() {
  const [rows, setRows] = useState<Entry[]>([]);
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    apiRequest<{ leaderboard: Entry[] }>("/api/events/demo-event/leaderboard")
      .then(result => { if (active) setRows(result.leaderboard.filter(row => row.submission)); })
      .catch(reason => {
        if (!active) return;
        if (reason instanceof Error && (reason.message.includes("published") || reason.message.includes("Authentication"))) setHidden(true);
        else setError(reason instanceof Error ? reason.message : "Results could not be loaded.");
      }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);
  if (hidden) return <section className={styles.hiddenState}><p>RESULTS ARE HIDDEN</p><h1>The podium is still under wraps.</h1><small>The organizer has not published the final results yet. Check back after judging closes.</small><Link href="/gallery">Back to Gallery</Link></section>;
  if (loading) return <p role="status">Loading published results…</p>;
  if (error) return <p role="alert">Results could not be loaded. {error} <button type="button" onClick={() => { setLoading(true); setError(""); setAttempt(value => value + 1); }}>Retry</button></p>;
  return <>
    <header className={styles.resultsHeader}><div><p className={styles.eyebrow}><span /> DOGFOOD HACKATHON <i /> FINAL SCORES</p><h1>Final Results</h1><p>Scores are calculated from submitted judge reviews.</p></div><span className={styles.publishedBadge}><i /> RESULTS PUBLISHED</span></header>
    <section className={styles.resultsIntro}><div><p>THE PODIUM</p><h2>Ideas that rose to the top.</h2></div><span>{rows.length} projects ranked</span></section>
    <section className={styles.rankedSection} aria-label="Live ranked results"><div className={styles.rankTable}><div className={styles.tableHeader}><span>RANK</span><span>PROJECT</span><span>TRACK</span><span>SCORE</span><span /></div>{rows.map(row => row.submission && <div className={styles.tableRow} key={row.submission.id}><strong className={styles.tableRank}>{String(row.rank).padStart(2, "0")}</strong><div className={styles.tableProject}><span className={styles.miniMark}>{row.submission.title.slice(0, 1)}</span><span><strong>{row.submission.title}</strong><small>{row.team?.name || "HackForge team"}</small></span></div><span className={styles.tableTrack}>{row.submission.track}</span><strong className={styles.tableScore}>{row.score === null ? "—" : row.score.toFixed(2)}</strong><Link className={styles.viewButton} href={`/projects/${row.submission.id}/view`}>View project</Link></div>)}</div></section>
  </>;
}
