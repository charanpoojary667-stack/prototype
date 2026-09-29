"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CountdownTimer from "../../countdown-timer";
import { apiBody, apiRequest } from "../../lib/api";
import styles from "./event.module.css";

type EventDates = { registrationStartAt: string; registrationEndAt: string; startAt: string; submissionDeadline: string; endAt: string };

export function EventCountdown() {
  const [event, setEvent] = useState<EventDates | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    apiRequest<{ event: EventDates }>("/api/events/demo-event").then(({ event: data }) => setEvent(data)).catch(() => setEvent(null));
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  if (!event) return <p role="status">Loading live event dates…</p>;
  let target = event.startAt;
  let label = "COUNTDOWN TO KICKOFF";
  if (now >= Date.parse(event.startAt) && now < Date.parse(event.registrationEndAt)) { target = event.registrationEndAt; label = "REGISTRATION CLOSES IN"; }
  else if (now >= Date.parse(event.registrationEndAt) && now < Date.parse(event.submissionDeadline)) { target = event.submissionDeadline; label = "SUBMISSIONS CLOSE IN"; }
  else if (now >= Date.parse(event.submissionDeadline)) label = "SUBMISSIONS CLOSED";
  return <CountdownTimer targetDate={target} label={label} />;
}

export function EventRegistration() {
  const [registered, setRegistered] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  useEffect(() => {
    apiRequest("/api/auth/me").then(() => {
      setSignedIn(true);
      return apiRequest<{ registered: boolean }>("/api/events/demo-event/register");
    }).then(result => setRegistered(result.registered)).catch(() => setSignedIn(false));
  }, []);
  async function register() {
    setPending(true); setMessage("");
    try {
      await apiRequest("/api/events/demo-event/register", { method: "POST", body: apiBody({}) });
      setRegistered(true); setMessage("You’re registered for DOGFOOD Hackathon.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Registration could not be completed."); }
    finally { setPending(false); }
  }
  return <>
    {registered ? <p className={styles.joinNote} role="status">You’re registered. Create your team to get started.</p> : signedIn
      ? <button className={styles.joinButton} disabled={pending} onClick={register} type="button">{pending ? "Registering…" : "Join Event"}</button>
      : <Link className={styles.joinButton} href="/login">Sign in to join</Link>}
    {message && <p className={styles.joinNote} role="status">{message}</p>}
  </>;
}
