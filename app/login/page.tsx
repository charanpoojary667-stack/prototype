import type { Metadata } from "next";
import Link from "next/link";
import LoginForm from "./login-form";
import styles from "./login.module.css";

export const metadata: Metadata = {
  title: "Sign in | HackForge",
  description: "Sign in to your HackForge hackathon workspace.",
};

export default function LoginPage() {
  return (
    <main className={styles.loginShell}>
      <section className={styles.visualPanel} aria-label="HackForge community">
        <div className={styles.visualContent}>
          <Link className={styles.brand} href="/" aria-label="HackForge home">
            <span className={styles.brandMark}><i /><i /><i /></span>
            <span>Hack<span>Forge</span></span>
          </Link>

          <div className={styles.visualMessage}>
            <p className={styles.eventEyebrow}><span /> DOGFOOD HACKATHON · FALL 2026</p>
            <h1>Good ideas are built together.</h1>
            <p className={styles.visualDescription}>
              Find your people, make something meaningful, and share it with the
              world.
            </p>
          </div>

          <div className={styles.eventFooter}>
            <div className={styles.eventDate}>
              <span className={styles.calendarIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="5" width="18" height="16" rx="2" />
                  <path d="M16 3v4M8 3v4M3 11h18" />
                </svg>
              </span>
              <span><strong>October 9–11</strong><small>Three days to build what matters</small></span>
            </div>
            <span className={styles.registrationStatus}><i /> Registration open</span>
          </div>
        </div>
      </section>

      <section className={styles.formPanel} aria-label="Sign in to HackForge">
        <div className={styles.formTopbar}>
          <Link href="/" className={styles.backLink}>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m15 18-6-6 6-6M9 12h12" />
            </svg>
            Back to dashboard
          </Link>
        </div>
        <LoginForm />
        <footer className={styles.formFooter}>
          <span>HackForge <i /> Built for builders</span>
          <span>Open source, community powered</span>
        </footer>
      </section>
    </main>
  );
}