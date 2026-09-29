import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./results.module.css";

export const metadata: Metadata = {
  title: "Final results | HackForge",
  description: "See the winning projects from the DOGFOOD Hackathon.",
};

type IconName = "arrow" | "calendar" | "check" | "grid" | "people" | "settings" | "spark" | "trophy";
const iconPaths: Record<IconName, ReactNode> = {
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  people: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.8 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.8-1l-1.7.6-1.4-2.4 1.4-1.1a7 7 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.8-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.8 1l1.7-.6 1.4 2.4-1.4 1.1a7 7 0 0 1 0 2Z" transform="translate(-1 -1)" /></>,
  spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2L12 3Z" /><path d="m19 14 1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2L19 14Z" /></>,
  trophy: <><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 7H4v2a4 4 0 0 0 4 4M17 7h3v2a4 4 0 0 1-4 4" /></>,
};

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{iconPaths[name]}</svg>;
}

const navigation = [
  { label: "Dashboard", href: "/", icon: "grid" as const },
  { label: "Events", href: "/events/demo-event", icon: "calendar" as const },
  { label: "My Team", href: "/teams/demo-team", icon: "people" as const },
  { label: "My Project", href: "/projects/civicsignal", icon: "spark" as const },
  { label: "Gallery", href: "/gallery", icon: "grid" as const, active: true },
  { label: "Settings", href: "/#settings", icon: "settings" as const },
];

function Sidebar() {
  return <aside className="sidebar"><Link className="brand" href="/" aria-label="HackForge home"><span className="brand-mark"><i /><i /><i /></span><span>Hack<span>Forge</span></span></Link><p className="sidebar-label">WORKSPACE</p><nav className="sidebar-nav" aria-label="Main navigation">{navigation.map((item) => <Link key={item.label} href={item.href} className={item.active ? "sidebar-link sidebar-link--active" : `sidebar-link${item.label === "Settings" ? " sidebar-link--settings" : ""}`} aria-current={item.active ? "page" : undefined}><Icon name={item.icon} size={18} /><span>{item.label}</span>{item.active && <span className="sidebar-active-marker" />}</Link>)}</nav><div className="sidebar-bottom"><div className="sidebar-event-note"><div className="sidebar-event-label"><span className="live-dot" /> RESULTS PUBLISHED</div><strong>DOGFOOD Hackathon</strong><span>Fall 2026 · Online</span><Link href="/events/demo-event">View event <Icon name="arrow" size={14} /></Link></div><span className="sidebar-version">HACKFORGE COMMUNITY <span>·</span> OPEN SOURCE</span></div></aside>;
}

type Result = { rank: number; id: string; name: string; team: string; track: string; score: string; prize?: string; tone: "green" | "coral" | "blue" };
const winners: Result[] = [
  { rank: 1, id: "civicsignal", name: "CivicSignal", team: "Pixel Pioneers", track: "Community & civic tech", score: "92.4", prize: "Grand prize", tone: "coral" },
  { rank: 2, id: "openshelf", name: "OpenShelf", team: "Good Neighbors", track: "Community & civic tech", score: "89.8", prize: "Open-source standout", tone: "green" },
  { rank: 3, id: "lumen", name: "Lumen", team: "Soft Systems", track: "Climate & good futures", score: "87.6", prize: "People's choice", tone: "blue" },
];
const otherResults: Result[] = [
  { rank: 4, id: "patchwork", name: "Patchwork", team: "Common Thread", track: "Open source for everyone", score: "85.9", tone: "green" },
  { rank: 5, id: "tidepool", name: "Tidepool", team: "Blue Hour", track: "Climate & good futures", score: "84.7", tone: "blue" },
  { rank: 6, id: "kindred", name: "Kindred", team: "Good Company", track: "Community & civic tech", score: "82.3", tone: "coral" },
  { rank: 7, id: "commons", name: "Commons Kit", team: "Civic Stack", track: "Open source for everyone", score: "80.6", tone: "green" },
  { rank: 8, id: "seedling", name: "Seedling", team: "Good Futures", track: "Climate & good futures", score: "78.9", tone: "blue" },
];

function ViewProject({ id, name }: { id: string; name: string }) {
  return <Link className={styles.viewButton} href={`/projects/${id}/view`}>View Project <Icon name="arrow" size={14} /><span className={styles.visuallyHidden}>{name}</span></Link>;
}

function HiddenResults() {
  return <section className={styles.hiddenState} aria-labelledby="hidden-results-title"><span className={styles.hiddenIcon}><Icon name="trophy" size={23} /></span><p>RESULTS ARE HIDDEN</p><h1 id="hidden-results-title">The podium is still under wraps.</h1><small>The organizer has not published the final results yet. Check back after judging closes.</small><Link href="/gallery">Back to Gallery <Icon name="arrow" size={14} /></Link></section>;
}

function WinnerCard({ result }: { result: Result }) {
  return <article className={`${styles.winnerCard} ${styles[`winner${result.rank}`]}`}><div className={`${styles.winnerArtwork} ${styles[`artwork${result.tone}`]}`}><span className={styles.rank}>{String(result.rank).padStart(2, "0")}</span><span className={styles.projectInitial}>{result.name.slice(0, 1)}</span><span className={styles.trackBadge}>{result.track}</span></div><div className={styles.winnerBody}><span className={styles.prizeBadge}>{result.prize}</span><h2>{result.name}</h2><p>{result.team}</p><span className={styles.trackName}>{result.track}</span><div className={styles.score}><strong>{result.score}</strong><small>/ 100 final score</small></div><ViewProject id={result.id} name={result.name} /></div></article>;
}

export default function ResultsPage() {
  const resultsPublished = true;
  return <div className="app-shell"><Sidebar /><div className="workspace-shell"><header className="topbar"><div className="topbar-inner"><div className="topbar-context"><span className="topbar-context-dot" /> COMMUNITY RESULTS</div><button className="profile-button" type="button" aria-label="Account menu for Jordan Lee"><span className="profile-avatar">JL</span><span className="profile-name">Jordan Lee</span><span className="profile-chevron">⌄</span></button></div></header><main className={`dashboard-main ${styles.resultsMain}`}><Link className={styles.backLink} href="/gallery"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m15 18-6-6 6-6M9 12h12" /></svg>Back to Gallery</Link>{resultsPublished ? <><header className={styles.resultsHeader}><div><p className={styles.eyebrow}><span /> DOGFOOD HACKATHON <i /> FALL 2026</p><h1>Final Results</h1><p>Celebrating the projects that made this hackathon worth showing up for.</p></div><span className={styles.publishedBadge}><i /> RESULTS PUBLISHED</span></header><section className={styles.resultsIntro}><div><p>THE PODIUM</p><h2>Ideas that rose to the top.</h2></div><span>8 projects ranked</span></section><section className={styles.winnersGrid} aria-label="Top three winning projects">{winners.map((result) => <WinnerCard key={result.id} result={result} />)}</section><section className={styles.rankedSection} aria-labelledby="ranked-title"><div className={styles.rankedHeading}><div><p>THE FULL FIELD</p><h2 id="ranked-title">Other ranked projects</h2></div><span>Final scores out of 100</span></div><div className={styles.rankTable}><div className={styles.tableHeader}><span>RANK</span><span>PROJECT</span><span>TRACK</span><span>SCORE</span><span /></div>{otherResults.map((result) => <div className={styles.tableRow} key={result.id}><strong className={styles.tableRank}>{String(result.rank).padStart(2, "0")}</strong><div className={styles.tableProject}><span className={`${styles.miniMark} ${styles[`artwork${result.tone}`]}`}>{result.name.slice(0, 1)}</span><span><strong>{result.name}</strong><small>{result.team}</small></span></div><span className={styles.tableTrack}><i className={styles[`dot${result.tone}`]} /> {result.track}</span><strong className={styles.tableScore}>{result.score}</strong><ViewProject id={result.id} name={result.name} /></div>)}</div></section></> : <HiddenResults />}<footer className={styles.resultsFooter}><span>HackForge <i /> Built for builders</span><Link href="/events/demo-event">DOGFOOD Hackathon <Icon name="arrow" size={14} /></Link></footer></main></div></div>;
}