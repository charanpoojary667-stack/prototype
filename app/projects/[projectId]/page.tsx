import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import ProjectDetailsForm from "./project-details-form";
import { getMockProject } from "./project-data";
import detailStyles from "./details.module.css";
import projectStyles from "../new/project.module.css";

type ProjectPageProps = {
  params: Promise<{ projectId: string }>;
};

export async function generateMetadata({ params }: ProjectPageProps): Promise<Metadata> {
  const { projectId } = await params;
  const project = getMockProject(projectId);
  return {
    title: project ? `${project.name} | HackForge` : "Project not found | HackForge",
    description: project?.tagline ?? "Project details for HackForge.",
  };
}

type IconName = "arrow" | "calendar" | "grid" | "people" | "settings" | "spark";

const iconPaths: Record<IconName, ReactNode> = {
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  people: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.8 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.8-1l-1.7.6-1.4-2.4 1.4-1.1a7 7 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.8-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.8 1l1.7-.6 1.4 2.4-1.4 1.1a7 7 0 0 1 0 2Z" transform="translate(-1 -1)" /></>,
  spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2L12 3Z" /><path d="m19 14 1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2L19 14Z" /></>,
};

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {iconPaths[name]}
    </svg>
  );
}

const navigation = [
  { label: "Dashboard", href: "/", icon: "grid" as const },
  { label: "Events", href: "/events/demo-event", icon: "calendar" as const },
  { label: "My Team", href: "/teams/demo-team", icon: "people" as const },
  { label: "My Project", href: "/projects/civicsignal", icon: "spark" as const, active: true },
  { label: "Gallery", href: "/#gallery", icon: "grid" as const },
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

function EmptyProjectState() {
  return (
    <section className={detailStyles.emptyState} aria-labelledby="empty-title">
      <span className={detailStyles.emptyMark}><Icon name="spark" size={23} /></span>
      <p className={detailStyles.emptyEyebrow}>PROJECT NOT FOUND</p>
      <h2 id="empty-title">This project hasn’t found its way here.</h2>
      <p>It may have moved, or this project link may be out of date. Start a new project or head back to your workspace.</p>
      <div>
        <Link className={detailStyles.emptyPrimary} href="/projects/new">Create a project <Icon name="arrow" size={15} /></Link>
        <Link className={detailStyles.emptySecondary} href="/">Back to dashboard</Link>
      </div>
    </section>
  );
}

export default async function ProjectDetailsPage({ params }: ProjectPageProps) {
  const { projectId } = await params;
  const project = getMockProject(projectId);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="workspace-shell">
        <header className="topbar">
          <div className="topbar-inner">
            <div className="topbar-context"><span className="topbar-context-dot" /> PROJECT STUDIO</div>
            <button className="profile-button" type="button" aria-label="Account menu for Jordan Lee">
              <span className="profile-avatar">JL</span>
              <span className="profile-name">Jordan Lee</span>
              <span className="profile-chevron">⌄</span>
            </button>
          </div>
        </header>

        <main className={`dashboard-main ${projectStyles.projectMain}`}>
          <Link className={projectStyles.backLink} href="/">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m15 18-6-6 6-6M9 12h12" /></svg>
            Back to Dashboard
          </Link>
          {project ? (
            <>
              <header className={`${projectStyles.pageHeading} ${detailStyles.detailsHeading}`}>
                <div>
                  <p className={projectStyles.pageEyebrow}><span /> DOGFOOD HACKATHON <i /> PROJECT PROFILE</p>
                  <h1>Edit your project</h1>
                  <p>Keep your team’s project details current as the idea takes shape.</p>
                </div>
                <span className={detailStyles.statusBadge}><i /> DRAFT SUBMISSION</span>
              </header>
              <ProjectDetailsForm project={project} />
            </>
          ) : (
            <EmptyProjectState />
          )}
          <footer className={projectStyles.pageFooter}>
            <span>HackForge <i /> Built for builders</span>
            <Link href="/events/demo-event">DOGFOOD Hackathon <Icon name="arrow" size={14} /></Link>
          </footer>
        </main>
      </div>
    </div>
  );
}