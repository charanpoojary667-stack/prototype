"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "./gallery.module.css";

type Project = {
  id: string;
  name: string;
  tagline: string;
  team: string;
  track: "Open source" | "Community" | "Climate";
  tags: string[];
  mark: string;
  tone: "green" | "coral" | "blue";
  updated: number;
  featured?: boolean;
};

const projects: Project[] = [
  { id: "civicsignal", name: "CivicSignal", tagline: "A better way to be heard locally.", team: "Pixel Pioneers", track: "Community", tags: ["Next.js", "Open data", "Civic tech"], mark: "C", tone: "coral", updated: 9, featured: true },
  { id: "openshelf", name: "OpenShelf", tagline: "Making neighborhood sharing feel effortless.", team: "Good Neighbors", track: "Community", tags: ["TypeScript", "Mutual aid", "Maps"], mark: "O", tone: "green", updated: 8, featured: true },
  { id: "lumen", name: "Lumen", tagline: "A clearer picture of your everyday footprint.", team: "Soft Systems", track: "Climate", tags: ["React", "Data viz", "Climate"], mark: "L", tone: "blue", updated: 7 },
  { id: "patchwork", name: "Patchwork", tagline: "Small skills, shared locally, made useful.", team: "Common Thread", track: "Open source", tags: ["Svelte", "Learning", "Community"], mark: "P", tone: "green", updated: 6 },
  { id: "tidepool", name: "Tidepool", tagline: "Turn shoreline observations into action.", team: "Blue Hour", track: "Climate", tags: ["Python", "Sensors", "Open data"], mark: "T", tone: "blue", updated: 5 },
  { id: "kindred", name: "Kindred", tagline: "A softer way to ask for a little help.", team: "Good Company", track: "Community", tags: ["Remix", "Care", "Design"], mark: "K", tone: "coral", updated: 4 },
  { id: "commons", name: "Commons Kit", tagline: "Practical building blocks for public-interest tools.", team: "Civic Stack", track: "Open source", tags: ["Node.js", "Open source", "APIs"], mark: "C", tone: "green", updated: 3 },
  { id: "seedling", name: "Seedling", tagline: "Plan a more resilient garden, one plot at a time.", team: "Good Futures", track: "Climate", tags: ["Vue", "Gardens", "Planning"], mark: "S", tone: "blue", updated: 2 },
];

function Icon({ name, size = 17 }: { name: "arrow" | "search" | "sliders"; size?: number }) {
  const paths = {
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
    sliders: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="9" cy="6" r="2" /><circle cx="15" cy="12" r="2" /><circle cx="8" cy="18" r="2" /></>,
  };

  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <article className={`${styles.projectCard} ${styles[`projectCard${project.tone}`]}`}>
      <div className={styles.cardArtwork} aria-hidden="true">
        <span className={styles.cardMark}>{project.mark}</span>
        {project.featured && <span className={styles.featuredLabel}>FEATURED</span>}
        <span className={styles.trackLabel}>{project.track}</span>
      </div>
      <div className={styles.cardBody}>
        <p className={styles.cardTrack}>{project.track} track</p>
        <h2>{project.name}</h2>
        <p className={styles.cardTagline}>{project.tagline}</p>
        <div className={styles.cardMeta}><span className={styles.teamMark}>{project.team.slice(0, 1)}</span>{project.team}</div>
        <div className={styles.cardTags}>{project.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
        <Link className={styles.viewButton} href={`/projects/${project.id}/view`}>
          View Project <Icon name="arrow" size={14} />
        </Link>
      </div>
    </article>
  );
}

export default function GalleryExplorer() {
  const [query, setQuery] = useState("");
  const [track, setTrack] = useState("all");
  const [sort, setSort] = useState("featured");

  const visibleProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = projects.filter((project) => {
      const matchesTrack = track === "all" || project.track === track;
      const searchable = [project.name, project.tagline, project.team, project.track, ...project.tags].join(" ").toLowerCase();
      return matchesTrack && (!normalizedQuery || searchable.includes(normalizedQuery));
    });

    return [...filtered].sort((first, second) => {
      if (sort === "newest") return second.updated - first.updated;
      if (sort === "name") return first.name.localeCompare(second.name);
      return Number(Boolean(second.featured)) - Number(Boolean(first.featured)) || second.updated - first.updated;
    });
  }, [query, sort, track]);

  function resetFilters() {
    setQuery("");
    setTrack("all");
    setSort("featured");
  }

  return (
    <section className={styles.explorer} aria-labelledby="gallery-results-title">
      <div className={styles.toolbar}>
        <label className={styles.searchField}>
          <span className={styles.visuallyHidden}>Search projects</span>
          <Icon name="search" />
          <input onChange={(event) => setQuery(event.target.value)} placeholder="Search projects, teams, or tags" type="search" value={query} />
        </label>
        <div className={styles.controlGroup}>
          <label className={styles.selectField}>
            <span className={styles.controlLabel}>Track</span>
            <select aria-label="Filter by track" onChange={(event) => setTrack(event.target.value)} value={track}>
              <option value="all">All tracks</option>
              <option value="Open source">Open source</option>
              <option value="Community">Community</option>
              <option value="Climate">Climate</option>
            </select>
          </label>
          <label className={styles.selectField}>
            <span className={styles.controlLabel}>Sort</span>
            <select aria-label="Sort projects" onChange={(event) => setSort(event.target.value)} value={sort}>
              <option value="featured">Featured</option>
              <option value="newest">Newest</option>
              <option value="name">A–Z</option>
            </select>
          </label>
          <span className={styles.filterIcon}><Icon name="sliders" size={16} /></span>
        </div>
      </div>

      <div className={styles.resultsHeading}>
        <div><p>COMMUNITY PROJECTS</p><h2 id="gallery-results-title">Find something that sparks an idea.</h2></div>
        <span>{visibleProjects.length} {visibleProjects.length === 1 ? "project" : "projects"}</span>
      </div>

      {visibleProjects.length > 0 ? (
        <div className={styles.projectGrid}>
          {visibleProjects.map((project) => <ProjectCard key={project.id} project={project} />)}
        </div>
      ) : (
        <div className={styles.emptyState} role="status">
          <span className={styles.emptyMark}><Icon name="search" size={23} /></span>
          <p>NO PROJECTS FOUND</p>
          <h2>That search came up quiet.</h2>
          <span>Try another phrase or clear the filters to see the whole showcase.</span>
          <button onClick={resetFilters} type="button">Clear filters <Icon name="arrow" size={14} /></button>
        </div>
      )}
    </section>
  );
}