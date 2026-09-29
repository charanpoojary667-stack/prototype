"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import styles from "../login/login.module.css";

export default function SignupForm() {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [feedback, setFeedback] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    if (formData.get("password") !== formData.get("confirmPassword")) {
      setFeedback("Those passwords do not match. Please try again.");
      return;
    }

    setFeedback("Your signup preview is ready. No account has been created.");
  }

  return (
    <div className={styles.formContent}>
      <div className={styles.formHeading}>
        <p className={styles.formEyebrow}>JOIN THE COMMUNITY</p>
        <h2>Create your account.</h2>
        <p>A few details and you’re ready to start building.</p>
      </div>

      <form className={styles.loginForm} onSubmit={handleSubmit}>
        <label className={styles.fieldGroup}>
          <span>Full name</span>
          <span className={styles.inputWrap}>
            <svg className={styles.fieldIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
            </svg>
            <input
              autoComplete="name"
              name="name"
              placeholder="Your name"
              required
              type="text"
            />
          </span>
        </label>

        <label className={styles.fieldGroup}>
          <span>Email address</span>
          <span className={styles.inputWrap}>
            <svg className={styles.fieldIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 7 9 6 9-6" />
            </svg>
            <input
              autoComplete="email"
              name="email"
              placeholder="you@example.com"
              required
              type="email"
            />
          </span>
        </label>

        <label className={styles.fieldGroup}>
          <span>Password</span>
          <span className={styles.inputWrap}>
            <svg className={styles.fieldIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="4" y="10" width="16" height="11" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
            </svg>
            <input
              autoComplete="new-password"
              minLength={8}
              name="password"
              placeholder="At least 8 characters"
              required
              type={passwordVisible ? "text" : "password"}
            />
            <button
              aria-label={passwordVisible ? "Hide password" : "Show password"}
              aria-pressed={passwordVisible}
              className={styles.visibilityToggle}
              onClick={() => setPasswordVisible((visible) => !visible)}
              type="button"
            >
              {passwordVisible ? "Hide" : "Show"}
            </button>
          </span>
        </label>

        <label className={styles.fieldGroup}>
          <span>Confirm password</span>
          <span className={styles.inputWrap}>
            <svg className={styles.fieldIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="4" y="10" width="16" height="11" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
            </svg>
            <input
              autoComplete="new-password"
              minLength={8}
              name="confirmPassword"
              placeholder="Enter your password again"
              required
              type={passwordVisible ? "text" : "password"}
            />
          </span>
        </label>

        <button className={styles.submitButton} type="submit">
          Create account
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12h14m-6-6 6 6-6 6" />
          </svg>
        </button>

        {feedback && <p className={styles.formFeedback} role="status">{feedback}</p>}
      </form>

      <p className={styles.modePrompt}>
        Already have an account? <Link className={styles.modeLink} href="/login">Sign in</Link>
      </p>

      <p className={styles.demoNote}>
        <span /> Frontend preview only · Account services aren’t connected
      </p>
    </div>
  );
}