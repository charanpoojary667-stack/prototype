"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "./lib/api";

type PlatformStats = { stats: { projects: number; teams: number; judges: number; events: number } };

export default function PlatformStats() {
  const [stats, setStats] = useState<{ projects: number; teams: number; judges: number; events: number } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    apiRequest<PlatformStats>("/api/platform/stats").then(({ stats: data }) => {
      if (!active) return;
      setStats(data);
      setError(false);
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []);
  const values = stats ? [stats.projects, stats.teams, stats.judges, stats.events] : null;
  return <section className="landing-stats" aria-label="Platform activity" aria-live="polite">
    {(["PROJECTS SUBMITTED", "TEAMS BUILDING", "JUDGES REVIEWING", "PUBLISHED EVENTS"] as const).map((label, index) => <div key={label}><strong>{values ? values[index] : "—"}</strong><span>{label}</span></div>)}
    {error && <span className="stats-note">Live platform totals are temporarily unavailable.</span>}
  </section>;
}
