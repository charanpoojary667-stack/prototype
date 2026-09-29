"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "./lib/api";

type EventInfo = {
  id: string;
  slug?: string;
  title: string;
  description?: string;
  status: string;
  registrationStartAt?: string | null;
  registrationEndAt?: string | null;
  startAt?: string | null;
  submissionDeadline?: string | null;
  judgingStartAt?: string | null;
  judgingEndAt?: string | null;
  endAt?: string | null;
  participantCount: number;
};

type Phase = { name: string; target: string | null };

function phaseAt(event: EventInfo, now: number): Phase {
  const time = (value?: string | null) => value ? Date.parse(value) : Number.NaN;
  const registrationStart = time(event.registrationStartAt);
  const registrationEnd = time(event.registrationEndAt);
  const submissionEnd = time(event.submissionDeadline);
  const judgingStart = time(event.judgingStartAt);
  const judgingEnd = time(event.judgingEndAt);
  const eventEnd = time(event.endAt);
  if (event.status === "completed" || (Number.isFinite(judgingEnd) && now >= judgingEnd) || (!Number.isFinite(judgingEnd) && Number.isFinite(eventEnd) && now >= eventEnd)) return { name: "Completed", target: null };
  if (Number.isFinite(judgingStart) && now >= judgingStart) return { name: "Judging", target: Number.isFinite(judgingEnd) ? event.judgingEndAt! : null };
  if (Number.isFinite(registrationStart) && now < registrationStart) return { name: "Upcoming", target: event.registrationStartAt! };
  if (Number.isFinite(registrationEnd) && now < registrationEnd) return { name: "Registration Open", target: event.registrationEndAt! };
  if (Number.isFinite(submissionEnd) && now < submissionEnd) return { name: "Submission Open", target: event.submissionDeadline! };
  if (Number.isFinite(judgingEnd) && now < judgingEnd) return { name: "Judging", target: event.judgingEndAt! };
  return { name: "Completed", target: null };
}

function countdown(target: string | null, now: number) {
  if (!target) return "Event complete";
  const seconds = Math.max(0, Math.floor((Date.parse(target) - now) / 1000));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(secs).padStart(2, "0")}s`;
}

function dateRange(event: EventInfo) {
  const start = event.startAt && new Date(event.startAt);
  const end = event.endAt && new Date(event.endAt);
  if (!start || Number.isNaN(start.getTime())) return "Dates to be announced";
  const format: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", timeZone: "UTC" };
  const first = start.toLocaleDateString(undefined, format);
  if (!end || Number.isNaN(end.getTime())) return first;
  return `${first} – ${end.toLocaleDateString(undefined, { ...format, year: "numeric" })}`;
}

export default function HomeEventBanner() {
  const [events, setEvents] = useState<EventInfo[] | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const result = await apiRequest<{ events: EventInfo[] }>("/api/events", { signal: controller.signal });
        if (active) { setEvents(result.events); setError(""); }
      } catch (cause) {
        if (active && !controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load events.");
      }
    };
    void refresh();
    const poll = window.setInterval(() => { void refresh(); }, 60_000);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { active = false; controller.abort(); window.clearInterval(poll); window.clearInterval(tick); };
  }, []);

  const initialLoading = events === null && !error;
  return (
    <section className="home-live-events" id="events" aria-labelledby="event-title">
      <div className="home-live-heading">
        <div><p className="eyebrow">HACKFORGE COMMUNITY</p><h2 id="event-title">Live events</h2></div>
        <span className="home-data-source">Local event schedule</span>
      </div>
      {initialLoading ? <p className="home-event-message" role="status">Loading events…</p> : null}
      {error && events === null ? <div className="home-event-message home-event-error" role="alert">Events could not be loaded. {error} <button type="button" onClick={() => window.location.reload()}>Retry</button></div> : null}
      {events && events.length === 0 ? <p className="home-event-message">There are no published events right now. Check back soon.</p> : null}
      {events && events.length > 0 ? <div className="home-event-grid">{events.map((event) => {
        const phase = now === null ? { name: "Checking schedule…", target: null } : phaseAt(event, now);
        const href = `/events/${event.slug || event.id}`;
        return <article className="home-event-card" key={event.id}>
          <div className="home-event-card-top"><span className={`home-event-status${phase.name === "Completed" ? " is-complete" : ""}`}>{phase.name}</span><span className="home-event-date">{dateRange(event)}</span></div>
          <h3>{event.title}</h3>
          <p className="home-event-description">{event.description || "Build with the community, submit your work, and share what you create."}</p>
          <div className="home-event-meta"><span>{event.participantCount} registered</span><span>{now === null ? "Schedule syncing" : countdown(phase.target, now)}</span></div>
          <Link href={href} className="home-event-link">View event <span aria-hidden="true">↗</span></Link>
        </article>;
      })}</div> : null}
      {error && events !== null ? <p className="home-event-stale" role="status">Showing saved event data; refresh failed.</p> : null}
    </section>
  );
}
