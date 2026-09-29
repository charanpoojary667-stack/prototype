"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ReactNode } from "react";
import { EventCountdown, EventRegistration } from "./event-live";
import styles from "./event.module.css";
import { apiRequest } from "../../lib/api";

type EventData = { title: string; description: string; venue: string; status: string; registrationStartAt: string; registrationEndAt: string; startAt: string; endAt: string; submissionDeadline: string; judgingStartAt: string; judgingEndAt: string; teamCapacity: number; participantCount: number; teamCount: number; projectCount: number; tracks: { id: string; name: string; description: string }[]; prizes: { name: string; value?: string; amount?: string }[]; rules: string[] };

type IconName = "arrow" | "calendar" | "check" | "clock" | "globe" | "grid" | "leaf" | "people" | "settings" | "spark" | "trophy";

const iconPaths: Record<IconName, ReactNode> = {
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  leaf: <><path d="M20 4c-8 0-14 3-14 10a6 6 0 0 0 6 6c7 0 10-6 8-16Z" /><path d="M4 21c3-5 7-8 12-11" /></>,
  people: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.8 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.8-1l-1.7.6-1.4-2.4 1.4-1.1a7 7 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.8-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.8 1l1.7-.6 1.4 2.4-1.4 1.1a7 7 0 0 1 0 2Z" transform="translate(-1 -1)" /></>,
  spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2L12 3Z" /><path d="m19 14 1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2L19 14Z" /></>,
  trophy: <><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 7H4v2a4 4 0 0 0 4 4M17 7h3v2a4 4 0 0 1-4 4" /></>,
};

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconPaths[name]}
    </svg>
  );
}

const navigation = [
  { label: "Dashboard", href: "/", icon: "grid" as const },
  { label: "Events", href: "/#events", icon: "calendar" as const, active: true },
  { label: "My Team", href: "/#my-team", icon: "people" as const },
  { label: "My Project", href: "/#my-project", icon: "spark" as const },
  { label: "Gallery", href: "/#gallery", icon: "globe" as const },
  { label: "Settings", href: "/#settings", icon: "settings" as const },
];

function Sidebar() {
  return (
    <aside className="sidebar">
      <Link className="brand" href="/" aria-label="HackForge home">
        <span className="brand-mark"><i /><i /><i /></span>
        <span>Hack<span>Forge</span></span>
      </Link>
      <p className="sidebar-label">WORKSPACE</p>
      <nav className="sidebar-nav" aria-label="Main navigation">
        {navigation.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={item.active ? "sidebar-link sidebar-link--active" : `sidebar-link${item.label === "Settings" ? " sidebar-link--settings" : ""}`}
            aria-current={item.active ? "page" : undefined}
          >
            <Icon name={item.icon} size={18} />
            <span>{item.label}</span>
            {item.active && <span className="sidebar-active-marker" />}
          </Link>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-event-note">
          <div className="sidebar-event-label"><span className="live-dot" /> HAPPENING SOON</div>
          <strong>DOGFOOD Hackathon</strong>
          <span>Oct 9–11, 2026</span>
          <Link href="/events/demo-event">View event <Icon name="arrow" size={14} /></Link>
        </div>
        <span className="sidebar-version">HACKFORGE COMMUNITY <span>·</span> OPEN SOURCE</span>
      </div>
    </aside>
  );
}

function SectionHeading({
  eyebrow,
  title,
  titleId,
}: {
  eyebrow: string;
  title: string;
  titleId: string;
}) {
  return (
    <div className={styles.sectionHeading}>
      <p>{eyebrow}</p>
      <h2 id={titleId}>{title}</h2>
    </div>
  );
}

export default function DemoEventPage({ slug = "demo-event" }: { slug?: string }) {
  const [event, setEvent] = useState<EventData | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { let active = true; apiRequest<{ event: EventData }>(`/api/events/${encodeURIComponent(slug)}`).then(({ event: data }) => { if (active) { setEvent(data); setError(""); } }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Event details could not be loaded."); }); return () => { active = false; }; }, [slug, attempt]);
  if (!event) return <main className={`dashboard-main ${styles.eventMain}`}><section role={error ? "alert" : "status"}>{error ? <>Event details could not be loaded. {error} <button type="button" onClick={() => { setError(""); setAttempt(value => value + 1); }}>Retry</button></> : "Loading event details…"}</section></main>;
  const prizeTotal = event.prizes.reduce((total, prize) => total + (Number(String(prize.value || prize.amount || "").replace(/[^\d.]/g, "")) || 0), 0);
  const prizeTotalLabel = prizeTotal ? `${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(prizeTotal)} in total prizes` : "Prize details set by the organizer";
  const phase = now === null ? "Checking schedule…" : now >= Date.parse(event.judgingEndAt) || (Number.isNaN(Date.parse(event.judgingEndAt)) && now >= Date.parse(event.endAt)) ? "Completed" : now >= Date.parse(event.judgingStartAt) ? "Judging" : now < Date.parse(event.registrationStartAt) ? "Upcoming" : now < Date.parse(event.registrationEndAt) ? "Registration Open" : now < Date.parse(event.startAt) ? "Registration Closed" : now < Date.parse(event.submissionDeadline) ? "Submissions Open" : "Submissions Closed";
  const dateLabel = (date: string) => new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
  const schedule = [event.startAt, event.submissionDeadline, event.endAt].map((date, index) => ({ date: dateLabel(date).toUpperCase(), day: new Date(date).toLocaleDateString(undefined, { weekday: "long", timeZone: "UTC" }), title: ["Event kickoff", "Submission deadline", "Event closes"][index], detail: ["The event begins.", "Submit your team project by this time.", "The event concludes."][index] }));
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="workspace-shell">
        <header className="topbar">
          <div className="topbar-inner">
            <div className="topbar-context"><span className="topbar-context-dot" /> EVENT DETAILS</div>
            <button className="profile-button" type="button" aria-label="Account menu">
              <span className="profile-avatar">HF</span>
              <span className="profile-name">My account</span>
              <span className="profile-chevron">⌄</span>
            </button>
          </div>
        </header>

        <main className={`dashboard-main ${styles.eventMain}`}>
          <Link className={styles.backLink} href="/">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m15 18-6-6 6-6M9 12h12" /></svg>
            Back to Dashboard
          </Link>

          <section className={styles.eventHero} aria-labelledby="event-title">
            <div className={styles.heroCopy}>
              <div className={styles.heroEyebrow}><span /> OPEN SOURCE COMMUNITY HACKATHON</div>
              <h1 id="event-title">{event.title}</h1>
              <p className={styles.heroSeason}>{new Date(event.startAt).getUTCFullYear()} <i /> Build something that matters.</p>
              <p>{event.description}</p>
              <div className={styles.heroMeta}>
                <span><Icon name="calendar" size={16} /> {dateLabel(event.startAt)}–{dateLabel(event.endAt)}, {new Date(event.startAt).getUTCFullYear()}</span>
                <span><Icon name="globe" size={16} /> {event.venue}</span>
                <span>{event.participantCount} registered · {event.teamCount} teams</span>
                <span>{event.projectCount} submitted projects</span>
              </div>
            </div>

            <aside className={styles.joinPanel} aria-label="Registration and event countdown">
              <div className={styles.registrationBadge}><span /> {phase}</div>
              <EventCountdown slug={slug} />
              <p className={styles.deadline}><Icon name="clock" size={14} /> Registration closes {new Date(event.registrationEndAt).toUTCString()}</p>
              <EventRegistration slug={slug} eventTitle={event.title} />
              <p className={styles.joinNote}>Free to join · No experience required</p>
            </aside>
          </section>

          <section className={styles.scheduleSection} aria-labelledby="schedule-title">
            <SectionHeading eyebrow="THREE DAYS, ONE BIG IDEA" title="Event dates" titleId="schedule-title" />
            <div className={styles.scheduleGrid}>
              {schedule.map((day, index) => (
                <article className={styles.scheduleCard} key={day.date}>
                  <div className={styles.scheduleDate}><span>{day.date}</span><span>{day.day}</span></div>
                  <div className={styles.scheduleMarker} aria-hidden="true"><i />{index < schedule.length - 1 && <span />}</div>
                  <div className={styles.scheduleDescription}>
                    <h3>{day.title}</h3>
                    <p>{day.detail}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <div className={styles.detailsGrid}>
            <section className={styles.tracksSection} aria-labelledby="tracks-title">
              <SectionHeading eyebrow="PICK A DIRECTION" title="Tracks" titleId="tracks-title" />
              <div className={styles.trackList}>
                {event.tracks.map((track, index) => (
                  <article className={styles.trackCard} key={track.id}>
                    <span className={`${styles.trackIcon} ${styles[["trackIcon--green", "trackIcon--coral", "trackIcon--blue"][index % 3]]}`}><Icon name={["spark", "people", "leaf"][index % 3] as "spark" | "people" | "leaf"} size={19} /></span>
                    <div className={styles.trackCopy}>
                      <span className={styles.trackNumber}>TRACK {String(index + 1).padStart(2, "0")}</span>
                      <h3>{track.name}</h3>
                      <p>{track.description}</p>
                    </div>
                    <Icon name="arrow" size={16} />
                  </article>
                ))}
              </div>
            </section>

            <div className={styles.sidebarDetails}>
              <section className={styles.prizesSection} aria-labelledby="prizes-title">
                <SectionHeading eyebrow="MAKE IT COUNT" title="Prizes" titleId="prizes-title" />
                <div className={styles.prizeList}>
                  {event.prizes.map((prize, index) => (
                    <div className={styles.prizeRow} key={`${prize.name}-${index}`}>
                      <span className={`${styles.prizePlace} ${styles[["prizeFirst", "prizeSecond", "prizeThird"][index % 3]]}`}>{String(index + 1).padStart(2, "0")}</span>
                      <span className={styles.prizeName}>{prize.name}</span>
                      <strong>{prize.amount || prize.value}</strong>
                    </div>
                  ))}
                  <p className={styles.prizeNote}><Icon name="trophy" size={15} /> {prizeTotalLabel}</p>
                </div>
              </section>

              <section className={styles.rulesSection} aria-labelledby="rules-title">
                <SectionHeading eyebrow="A FEW GOOD PRINCIPLES" title="Rules & highlights" titleId="rules-title" />
                <ul>
                  {event.rules.map((rule) => (
                    <li key={rule}><span><Icon name="check" size={13} /></span>{rule}</li>
                  ))}
                </ul>
                <p className={styles.teamSize}><Icon name="people" size={15} /> Teams of up to {event.teamCapacity} builders</p>
              </section>
            </div>
          </div>

          <footer className={styles.pageFooter}>
            <span>HackForge <i /> Built for builders</span>
            <Link href="/">Return to Dashboard <Icon name="arrow" size={14} /></Link>
          </footer>
        </main>
      </div>
    </div>
  );
}
