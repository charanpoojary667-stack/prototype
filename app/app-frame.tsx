"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type NavigationItem = { label: string; href: string; icon: "calendar" | "grid" | "image" | "project" | "team" | "judge" | "trophy" | "results" };

const navigation: NavigationItem[] = [
  { label: "Dashboard", href: "/", icon: "grid" },
  { label: "Events", href: "/events/demo-event", icon: "calendar" },
  { label: "Gallery", href: "/gallery", icon: "image" },
  { label: "My Team", href: "/teams/demo-team", icon: "team" },
  { label: "My Project", href: "/projects/civicsignal", icon: "project" },
  { label: "Judge Dashboard", href: "/judge/dashboard", icon: "judge" },
  { label: "Organizer Dashboard", href: "/organizer/dashboard", icon: "trophy" },
  { label: "Judge Management", href: "/organizer/judges", icon: "team" },
  { label: "Results", href: "/results", icon: "results" },
];

const iconPaths: Record<NavigationItem["icon"], ReactNode> = {
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></>,
  project: <><path d="m15 5 4 4M4 20l4.5-1 10.8-10.8a2.1 2.1 0 0 0-3-3L5.5 16 4 20Z" /><path d="M13 7 17 11" /></>,
  team: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
  judge: <><path d="M8 4h8l3 5-7 4-7-4 3-5Z" /><path d="m7 13 5 3 5-3M12 16v5M8 21h8" /></>,
  trophy: <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 7H4v2a4 4 0 0 0 4 4M17 7h3v2a4 4 0 0 1-4 4" />,
  results: <><path d="M4 19V5M4 19h17" /><path d="m7 15 4-4 3 2 6-7" /></>,
};

function Icon({ name, size = 18 }: { name: NavigationItem["icon"]; size?: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{iconPaths[name]}</svg>;
}

function isCurrentPage(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/events/demo-event") return pathname.startsWith("/events/") || pathname.startsWith("/organizer/events/");
  if (href === "/organizer/judges") return pathname.startsWith(href);
  if (href === "/judge/dashboard") return pathname.startsWith("/judge/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

function GlobalNavigation({ pathname }: { pathname: string }) {
  return <aside className="sidebar global-navigation"><Link className="brand" href="/" aria-label="HackForge home"><span className="brand-mark"><i /><i /><i /></span><span>Hack<span>Forge</span></span></Link><p className="sidebar-label">HACKFORGE WORKSPACE</p><nav className="sidebar-nav" aria-label="Primary navigation">{navigation.map((item) => {
    const active = isCurrentPage(pathname, item.href);
    return <Link aria-current={active ? "page" : undefined} className={active ? "sidebar-link sidebar-link--active" : "sidebar-link"} href={item.href} key={item.href}><Icon name={item.icon} size={18} /><span>{item.label}</span>{active && <span className="sidebar-active-marker" />}</Link>;
  })}</nav><div className="sidebar-bottom"><div className="sidebar-event-note"><div className="sidebar-event-label"><span className="live-dot" /> EVENT LIVE</div><strong>DOGFOOD Hackathon</strong><span>Oct 9–11, 2026</span><Link href="/events/demo-event">View event <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></Link></div><span className="sidebar-version">HACKFORGE COMMUNITY <span>·</span> OPEN SOURCE</span></div></aside>;
}

export default function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const showNavigation = pathname !== "/login" && pathname !== "/signup";

  return <div className={showNavigation ? "site-frame" : "site-frame site-frame--public"}>{showNavigation && <GlobalNavigation pathname={pathname} />}<div className="app-content">{children}</div></div>;
}