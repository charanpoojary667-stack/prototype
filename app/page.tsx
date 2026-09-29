import Link from "next/link";
import type { ReactNode } from "react";
import RecentProjects from "./recent-projects";
import DashboardOverview from "./dashboard-overview";
import HomeEventBanner from "./home-event-banner";


type IconName =
  | "arrow"
  | "calendar"
  | "check"
  | "chevron"
  | "clock"
  | "edit"
  | "grid"
  | "image"
  | "plus"
  | "settings"
  | "sparkle"
  | "users";

const iconPaths: Record<IconName, ReactNode> = {
  arrow: <path d="M7 17 17 7M7 7h10v10" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  edit: <><path d="m15 5 4 4M4 20l4.5-1 10.8-10.8a2.1 2.1 0 0 0-3-3L5.5 16 4 20Z" /><path d="M13 7 17 11" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  settings: <><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.8 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.8-1l-1.7.6-1.4-2.4 1.4-1.1a7 7 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.8-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.8 1l1.7-.6 1.4 2.4-1.4 1.1a7 7 0 0 1 0 2Z" transform="translate(-1 -1)" /></>,
  sparkle: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2L12 3Z" /><path d="m19 14 1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2L19 14Z" /></>,
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

const navigation = [
  { label: "Dashboard", href: "#dashboard", active: true, icon: "grid" as const },
  { label: "Events", href: "#events", active: false, icon: "calendar" as const },
  { label: "My Team", href: "#my-team", active: false, icon: "users" as const },
  { label: "My Project", href: "#my-project", active: false, icon: "edit" as const },
  { label: "Gallery", href: "#gallery", active: false, icon: "image" as const },
  { label: "Settings", href: "#settings", active: false, icon: "settings" as const },
];

function SectionHeading({
  eyebrow,
  title,
  titleId,
  href,
  linkLabel,
}: {
  eyebrow: string;
  title: string;
  titleId?: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={titleId}>{title}</h2>
      </div>
      {href && linkLabel && (
        <Link className="text-link" href={href}>
          {linkLabel} <Icon name="arrow" size={15} />
        </Link>
      )}
    </div>
  );
}

function QuickAction({
  label,
  icon,
  href,
  tone,
}: {
  label: string;
  icon: IconName;
  href: string;
  tone: string;
}) {
  return (
    <Link className="quick-action" href={href}>
      <span className={`quick-icon ${tone}`}><Icon name={icon} size={18} /></span>
      <span>{label}</span>
      <Icon name="chevron" size={16} />
    </Link>
  );
}

function Sidebar() {
  return (
    <aside className="sidebar">
      <Link className="brand" href="#dashboard" aria-label="HackForge home">
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
          <div className="sidebar-event-label">EVENTS</div>
          <strong>Find your next build</strong>
          <span>Explore published events</span>
          <Link href="#events">Browse events <Icon name="arrow" size={14} /></Link>
        </div>
        <span className="sidebar-version">HACKFORGE COMMUNITY <span>·</span> OPEN SOURCE</span>
      </div>
    </aside>
  );
}

export default function Home() {
  return (
    <div className="app-shell" id="dashboard">
      <Sidebar />
      <div className="workspace-shell">
        <header className="topbar">
          <div className="topbar-inner">
            <div className="topbar-context"><span className="topbar-context-dot" /> PARTICIPANT WORKSPACE</div>
          <button className="profile-button" type="button" aria-label="Account menu">
            <span className="profile-avatar">HF</span>
            <span className="profile-name">My account</span>
            <span className="profile-chevron">⌄</span>
          </button>
          </div>
        </header>

        <main className="dashboard-main">
        <section className="welcome-row" aria-labelledby="welcome-title">
          <div>
            <p className="welcome-date"><span className="date-marker" /> HACKFORGE BUILDER WORKSPACE</p>
            <h1 id="welcome-title">Build. Submit. <span>Judge. Win.</span></h1>
            <p className="welcome-copy">Your next big idea starts with showing up.</p>
          </div>
          <Link href="#events" className="browse-events"><Icon name="sparkle" size={17} /> Browse events</Link>
        </section>

        <HomeEventBanner />

        <DashboardOverview />

        <section className="quick-section" aria-labelledby="quick-title">
          <SectionHeading eyebrow="MAKE YOUR NEXT MOVE" title="Quick actions" titleId="quick-title" />
          <div className="quick-actions">
            <QuickAction label="Create team" icon="plus" href="#my-team" tone="quick-icon--green" />
            <QuickAction label="Edit project" icon="edit" href="#my-project" tone="quick-icon--peach" />
            <QuickAction label="Submit project" icon="check" href="#my-project" tone="quick-icon--yellow" />
            <QuickAction label="Explore gallery" icon="image" href="#gallery" tone="quick-icon--blue" />
          </div>
        </section>

        <section className="recent-section" id="gallery" aria-labelledby="recent-title">
          <SectionHeading eyebrow="FROM THE COMMUNITY" title="Recent projects" titleId="recent-title" href="#gallery" linkLabel="Explore gallery" />
          <RecentProjects />
        </section>

        <footer className="dashboard-footer">
          <span><span className="footer-brand-mark">H</span> Made for people who make things.</span>
          <span>Open source, built together <span className="footer-heart">♥</span></span>
        </footer>
        </main>
      </div>
    </div>
  );
}
