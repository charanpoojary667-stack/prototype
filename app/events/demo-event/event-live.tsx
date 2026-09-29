"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CountdownTimer from "../../countdown-timer";
import { apiBody, apiRequest } from "../../lib/api";
import styles from "./event.module.css";

type EventDates = { registrationStartAt: string; registrationEndAt: string; startAt: string; submissionDeadline: string; endAt: string };

export function EventCountdown({ slug = "demo-event" }: { slug?: string }) {
  const [event, setEvent] = useState<EventDates | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(0);
  useEffect(() => {
    let active = true;
    apiRequest<{ event: EventDates }>(`/api/events/${encodeURIComponent(slug)}`).then(({ event: data }) => { if (active) { setEvent(data); setFailed(false); } }).catch(() => { if (active) { setEvent(null); setFailed(true); } });
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { active = false; window.clearInterval(timer); };
  }, [slug]);
  if (!event) return <p role={failed ? "alert" : "status"}>{failed ? "Live schedule is unavailable right now." : "Loading live event dates…"}</p>;
  let target = event.startAt;
  let label = "COUNTDOWN TO KICKOFF";
  if (now >= Date.parse(event.startAt) && now < Date.parse(event.registrationEndAt)) { target = event.registrationEndAt; label = "REGISTRATION CLOSES IN"; }
  else if (now >= Date.parse(event.registrationEndAt) && now < Date.parse(event.submissionDeadline)) { target = event.submissionDeadline; label = "SUBMISSIONS CLOSE IN"; }
  else if (now >= Date.parse(event.submissionDeadline)) label = "SUBMISSIONS CLOSED";
  return <CountdownTimer targetDate={target} label={label} />;
}

export function EventRegistration({ slug = "demo-event", eventTitle = "this event" }: { slug?: string; eventTitle?: string }) {
  const [registered, setRegistered] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  useEffect(() => {
    let active = true;
    apiRequest("/api/auth/me").then(() => {
      if (active) setSignedIn(true);
      return apiRequest<{ registered: boolean }>(`/api/events/${encodeURIComponent(slug)}/register`);
    }).then(result => { if (active) setRegistered(result.registered); }).catch(() => { if (active) setSignedIn(false); });
    return () => { active = false; };
  }, [slug]);
  async function register() {
    setPending(true); setMessage("");
    try {
      await apiRequest(`/api/events/${encodeURIComponent(slug)}/register`, { method: "POST", body: apiBody({}) });
      setRegistered(true); setMessage(`You’re registered for ${eventTitle}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Registration could not be completed."); }
    finally { setPending(false); }
  }
  return <>
    {registered ? <p className={styles.joinNote} role="status">You’re registered. <Link href={`/teams/demo-team?eventId=${encodeURIComponent(slug)}`}>Create or join your team</Link>.</p> : signedIn
      ? <button className={styles.joinButton} disabled={pending} onClick={register} type="button">{pending ? "Registering…" : "Join Event"}</button>
      : <Link className={styles.joinButton} href="/login">Sign in to join</Link>}
    {message && <p className={styles.joinNote} role="status">{message}</p>}
  </>;
}
