import Link from "next/link";
import styles from "./view.module.css";

export default function PublicProjectLoading() {
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-hidden="true"><Link className="brand" href="/"><span className="brand-mark"><i /><i /><i /></span><span>Hack<span>Forge</span></span></Link><nav className="sidebar-nav"><span className="sidebar-link">Loading project</span></nav></aside>
      <div className="workspace-shell"><header className="topbar"><div className="topbar-inner"><div className="topbar-context">PROJECT SHOWCASE</div></div></header><main className={`dashboard-main ${styles.viewMain}`} aria-busy="true" aria-label="Loading public project"><div className={`${styles.loadingBar} ${styles.loadingBack}`} /><div className={styles.loadingHero} /><div className={styles.loadingLayout}><div className={styles.loadingPrimary}><span className={styles.loadingBar} /><span className={styles.loadingBar} /><span className={styles.loadingBar} /></div><div className={styles.loadingAside}><span className={styles.loadingBar} /><span className={styles.loadingBar} /></div></div><span className={styles.visuallyHidden} role="status">Loading project...</span></main></div>
    </div>
  );
}