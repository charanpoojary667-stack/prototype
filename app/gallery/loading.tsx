import Link from "next/link";
import styles from "./gallery.module.css";

export default function GalleryLoading() {
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-hidden="true">
        <Link className="brand" href="/">
          <span className="brand-mark"><i /><i /><i /></span>
          <span>Hack<span>Forge</span></span>
        </Link>
        <nav className="sidebar-nav"><span className="sidebar-link">Loading gallery</span></nav>
      </aside>
      <div className="workspace-shell">
        <header className="topbar"><div className="topbar-inner"><div className="topbar-context">COMMUNITY GALLERY</div></div></header>
        <main className={`dashboard-main ${styles.galleryMain}`} aria-busy="true" aria-label="Loading project gallery">
          <div className={`${styles.loadingBar} ${styles.loadingBack}`} />
          <div className={`${styles.loadingBar} ${styles.loadingTitle}`} />
          <div className={`${styles.loadingBar} ${styles.loadingSubtitle}`} />
          <div className={styles.loadingToolbar}><span className={styles.loadingBar} /><span className={styles.loadingBar} /></div>
          <div className={styles.loadingGrid}>{Array.from({ length: 6 }, (_, index) => <span className={styles.loadingCard} key={index}><i className={styles.loadingBar} /><b className={styles.loadingBar} /><em className={styles.loadingBar} /></span>)}</div>
          <span className={styles.visuallyHidden} role="status">Loading project gallery...</span>
        </main>
      </div>
    </div>
  );
}