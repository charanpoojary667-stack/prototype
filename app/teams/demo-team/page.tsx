import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import TeamWorkspace from "./team-workspace";
import styles from "./team.module.css";

export const metadata: Metadata = {
  title: "Pixel Pioneers | HackForge",
  description: "Meet the Pixel Pioneers team for the DOGFOOD Hackathon.",
};

type IconName = "arrow" | "calendar" | "check" | "grid" | "link" | "people" | "settings" | "spark" | "users";

const iconPaths: Record<IconName, ReactNode> = {
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7.1 0l3-3A5 5 0 0 0 13 2.9l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.1 0l-3 3A5 5 0 0 0 11 21.1l1.7-1.7" /></>,
  people: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.8 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.8-1l-1.7.6-1.4-2.4 1.4-1.1a7 7 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.8-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.8 1l1.7-.6 1.4 2.4-1.4 1.1a7 7 0 0 1 0 2Z" transform="translate(-1 -1)" /></>,
  spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2L12 3Z" /><path d="m19 14 1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2L19 14Z" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
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

const otherMembers: { id: string; name: string; role: string; initials: string }[] = [];

function Sidebar({ eventId }: { eventId: string }) {
  const navigation = [
    { label: "Dashboard", href: "/", icon: "grid" as const },
    { label: "Events", href: `/events/${eventId}`, icon: "calendar" as const },
    { label: "My Team", href: `/teams/demo-team?eventId=${encodeURIComponent(eventId)}`, icon: "users" as const, active: true },
    { label: "My Project", href: "/#my-project", icon: "spark" as const },
    { label: "Gallery", href: "/#gallery", icon: "people" as const },
    { label: "Settings", href: "/#settings", icon: "settings" as const },
  ];
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
          <Link href={`/events/${eventId}`}>View event <Icon name="arrow" size={14} /></Link>
        </div>
        <span className="sidebar-version">HACKFORGE COMMUNITY <span>·</span> OPEN SOURCE</span>
      </div>
    </aside>
  );
}

function TeamLeader() {
  return (
    <article className={styles.leaderCard}>
      <div className={styles.leaderAvatar} aria-hidden="true">JL<span /></div>
      <div className={styles.leaderInfo}>
        <span className={styles.cardEyebrow}>TEAM LEADER</span>
        <h3>Jordan Lee</h3>
        <p>Product designer · Building CivicSignal</p>
      </div>
      <span className={styles.leaderBadge}><Icon name="spark" size={13} /> LEADER</span>
    </article>
  );
}

function MemberList() {
  return (
    <section className={styles.membersPanel} aria-labelledby="members-title">
      <div className={styles.panelHeading}>
        <div>
          <span className={styles.cardEyebrow}>YOUR CREW</span>
          <h2 id="members-title">Team members</h2>
        </div>
        <span className={styles.memberCount}>01 <span>MEMBER</span></span>
      </div>
      <TeamLeader />
      <div className={styles.otherMembers}>
        {otherMembers.length > 0 ? (
          otherMembers.map((member) => (
            <article className={styles.memberRow} key={member.id}>
              <span className={styles.memberAvatar}>{member.initials}</span>
              <span className={styles.memberDetails}><strong>{member.name}</strong><small>{member.role}</small></span>
            </article>
          ))
        ) : (
          <div className={styles.emptyMembers}>
            <span className={styles.emptyIcon}><Icon name="users" size={22} /></span>
            <h3>Your next teammate is out there.</h3>
            <p>No other members yet. Share an invite and start building your crew.</p>
            <span className={styles.openSlots}>3 OPEN SPOTS</span>
          </div>
        )}
      </div>
    </section>
  );
}

export default async function DemoTeamPage({ searchParams }: { searchParams: Promise<{ eventId?: string }> }) {
  const eventId = (await searchParams).eventId || "demo-event";
  return (
    <div className="app-shell">
      <Sidebar eventId={eventId} />
      <div className="workspace-shell">
        <header className="topbar">
          <div className="topbar-inner">
            <div className="topbar-context"><span className="topbar-context-dot" /> TEAM SPACE</div>
            <button className="profile-button" type="button" aria-label="Account menu">
              <span className="profile-avatar">HF</span>
              <span className="profile-name">My account</span>
              <span className="profile-chevron">⌄</span>
            </button>
          </div>
        </header>

        <main className={`dashboard-main ${styles.teamMain}`}>
          <Link className={styles.backLink} href="/events/demo-event">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m15 18-6-6 6-6M9 12h12" /></svg>
            Back to event
          </Link>

          <TeamWorkspace />

          <footer className={styles.teamFooter}>
            <span>HackForge <i /> Built for builders</span>
            <Link href="/">Return to Dashboard <Icon name="arrow" size={14} /></Link>
          </footer>
        </main>
      </div>
    </div>
  );
}
