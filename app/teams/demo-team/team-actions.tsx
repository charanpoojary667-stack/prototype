"use client";

import { useState } from "react";
import styles from "./team.module.css";

const invitePath = "/teams/demo-team?invite=HF26-PIXEL";

export function InviteMemberButton() {
  function showInviteLink() {
    const inviteSection = document.getElementById("invite-link");
    inviteSection?.scrollIntoView({ behavior: "smooth", block: "center" });
    document.getElementById("invite-url")?.focus({ preventScroll: true });
  }

  return (
    <button className={styles.inviteMemberButton} onClick={showInviteLink} type="button">
      <span>+</span> Invite member
    </button>
  );
}

export function CopyInviteButton() {
  const [feedback, setFeedback] = useState("");

  async function copyInviteLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${invitePath}`);
      setFeedback("Invite link copied to clipboard.");
    } catch {
      setFeedback("Copy unavailable. Select the link above to copy it manually.");
    }
  }

  return (
    <div className={styles.copyControl}>
      <button className={styles.copyButton} onClick={copyInviteLink} type="button">
        Copy invite link
      </button>
      <span aria-live="polite" className={styles.copyFeedback}>{feedback}</span>
    </div>
  );
}