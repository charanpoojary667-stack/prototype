import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import JudgeManagement from "./judge-management";
import styles from "./judges.module.css";

export const metadata: Metadata = {
  title: "Judge management | HackForge",
  description: "Manage judges and review assignments for the DOGFOOD Hackathon.",
};

type IconName = "arrow" | "calendar" | "grid" | "people" | "settings" | "spark" | "trophy";
const iconPaths: Record<IconName, ReactNode> = {
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  people: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.8 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.8-1l-1.7.6-1.4-2.4 1.4-1.1a7 7 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.8-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.8 1l1.7-.6 1.4 2.4-1.4 1.1a7 7 0 0 1 0 2Z" transform="translate(-1 -1)" /></>,
  spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2L12 3Z" /><path d="m19 14 1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2L19 14Z" /></>,
  trophy: <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 7H4v2a4 4 0 0 0 4 4M17 7h3v2a4 4 0 0 1-4 4" />,
};

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{iconPaths[name]}</svg>;
}

const navigation = [
  { label: "Dashboard", href: "/", icon: "grid" as const },
  { label: "Events", href: "/events/demo-event", icon: "calendar" as const },
  { label: "My Team", href: "/teams/demo-team", icon: "people" as const },
  { label: "My Project", href: "/projects/civicsignal", icon: "spark" as const },
  { label: "Gallery", href: "/gallery", icon: "grid" as const },
  { label: "Organizer Dashboard", href: "/organizer/dashboard", icon: "trophy" as const },
  { label: "Judge Management", href: "/organizer/judges", icon: "people" as const, active: true },
  { label: "Settings", href: "/#settings", icon: "settings" as const },
];

function Sidebar() {
  return <aside className="sidebar"><Link className="brand" href="/" aria-label="HackForge home"><span className="brand-mark"><i /><i /><i /></span><span>Hack<span>Forge</span></span></Link><p className="sidebar-label">ORGANIZER WORKSPACE</p><nav className="sidebar-nav" aria-label="Organizer navigation">{navigation.map((item) => <Link key={item.label} href={item.href} className={item.active ? "sidebar-link sidebar-link--active" : `sidebar-link${item.label === "Settings" ? " sidebar-link--settings" : ""}`} aria-current={item.active ? "page" : undefined}><Icon name={item.icon} size={18} /><span>{item.label}</span>{item.active && <span className="sidebar-active-marker" />}</Link>)}</nav><div className="sidebar-bottom"><div className="sidebar-event-note"><div className="sidebar-event-label"><span className="live-dot" /> EVENT LIVE</div><strong>DOGFOOD Hackathon</strong><span>Oct 9–11, 2026</span><Link href="/events/demo-event">View event <Icon name="arrow" size={14} /></Link></div><span className="sidebar-version">HACKFORGE COMMUNITY <span>·</span> OPEN SOURCE</span></div></aside>;
}

export default function JudgeManagementPage() {
  return <div className="app-shell"><Sidebar /><div className="workspace-shell"><header className="topbar"><div className="topbar-inner"><div className="topbar-context"><span className="topbar-context-dot" /> ORGANIZER WORKSPACE</div><button className="profile-button" type="button" aria-label="Account menu"><span className="profile-avatar">HF</span><span className="profile-name">My account</span><span className="profile-chevron">⌄</span></button></div></header><main className={`dashboard-main ${styles.judgesMain}`}><Link className={styles.backLink} href="/organizer/dashboard"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m15 18-6-6 6-6M9 12h12" /></svg>Back to Organizer Dashboard</Link><JudgeManagement /><footer className={styles.footer}><span>HackForge <i /> Built for builders</span><Link href="/events/demo-event">DOGFOOD Hackathon <Icon name="arrow" size={14} /></Link></footer></main></div></div>;
}