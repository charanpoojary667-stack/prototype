import Link from "next/link";
import styles from "./details.module.css";

export default function ProjectDetailsLoading() {
  return (
    <div className={`app-shell ${styles.loadingShell}`}>
      <aside className="sidebar" aria-hidden="true">
        <Link className="brand" href="/">
          <span className="brand-mark"><i /><i /><i /></span>
          <span>Hack<span>Forge</span></span>
        </Link>
        <nav className="sidebar-nav"><span className="sidebar-link">Loading workspace</span></nav>
      </aside>
      <div className="workspace-shell">
        <header className="topbar"><div className="topbar-inner"><div className="topbar-context">PROJECT STUDIO</div></div></header>
        <main className={`dashboard-main ${styles.loadingMain}`} aria-busy="true" aria-label="Loading project details">
          <div className={`${styles.loadingBar} ${styles.loadingBack}`} />
          <div className={`${styles.loadingBar} ${styles.loadingTitle}`} />
          <div className={`${styles.loadingBar} ${styles.loadingSubtitle}`} />
          <div className={styles.loadingGrid}>
            <section className={styles.loadingForm}>
              {Array.from({ length: 6 }, (_, index) => <span className={styles.loadingBar} key={index} />)}
            </section>
            <aside className={styles.loadingAside}>
              <span className={styles.loadingBar} />
              <span className={styles.loadingBar} />
            </aside>
          </div>
        </main>
      </div>
      <span className={styles.visuallyHidden} role="status">Loading project details…</span>
    </div>
  );
}