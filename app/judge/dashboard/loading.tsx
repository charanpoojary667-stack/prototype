import Link from "next/link";
import styles from "./judge.module.css";

export default function JudgeDashboardLoading() {
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-hidden="true"><Link className="brand" href="/"><span className="brand-mark"><i /><i /><i /></span><span>Hack<span>Forge</span></span></Link><nav className="sidebar-nav"><span className="sidebar-link">Loading judge workspace</span></nav></aside>
      <div className="workspace-shell"><header className="topbar"><div className="topbar-inner"><div className="topbar-context">JUDGE WORKSPACE</div></div></header><main className={`dashboard-main ${styles.judgeMain}`} aria-busy="true" aria-label="Loading judge dashboard"><div className={`${styles.loadingBar} ${styles.loadingTitle}`} /><div className={`${styles.loadingBar} ${styles.loadingSubtitle}`} /><div className={styles.loadingStats}>{Array.from({ length: 4 }, (_, index) => <span className={styles.loadingBar} key={index} />)}</div><div className={styles.loadingCards}>{Array.from({ length: 4 }, (_, index) => <span className={styles.loadingCard} key={index}><i className={styles.loadingBar} /><b className={styles.loadingBar} /><em className={styles.loadingBar} /></span>)}</div><span className={styles.visuallyHidden} role="status">Loading judge dashboard...</span></main></div>
    </div>
  );
}