"use client";

import { useState, type FormEvent } from "react";
import styles from "./event-editor.module.css";

type Track = { id: number; name: string; description: string };
type Prize = { id: number; name: string; amount: string; description: string };

function Icon({ name, size = 15 }: { name: "calendar" | "check" | "close" | "people" | "plus"; size?: number }) {
  const paths = { calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>, check: <path d="m5 12 4 4L19 6" />, close: <path d="m6 6 12 12M18 6 6 18" />, people: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>, plus: <path d="M12 5v14M5 12h14" /> };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

const initialTracks: Track[] = [
  { id: 1, name: "Open source for everyone", description: "Tools that invite more people to learn, contribute, and create." },
  { id: 2, name: "Community & civic tech", description: "Practical ideas that bring neighbors and local communities closer." },
  { id: 3, name: "Climate & good futures", description: "Grounded ways to care for the places we share." },
];
const initialPrizes: Prize[] = [
  { id: 1, name: "Grand prize", amount: "$5,000", description: "For the project that brings the whole brief together." },
  { id: 2, name: "Open-source standout", amount: "$2,000", description: "For thoughtful, reusable work made in the open." },
  { id: 3, name: "People's choice", amount: "$1,000", description: "Selected by the HackForge community." },
];

export default function EventEditor() {
  const [eventName, setEventName] = useState("DOGFOOD Hackathon");
  const [description, setDescription] = useState("Three days to turn a good idea into something real. Find your team, make in the open, and show the world what you built.");
  const [status, setStatus] = useState("Published");
  const [registrationStart, setRegistrationStart] = useState("2026-09-01");
  const [registrationEnd, setRegistrationEnd] = useState("2026-10-08");
  const [hackathonStart, setHackathonStart] = useState("2026-10-09");
  const [hackathonEnd, setHackathonEnd] = useState("2026-10-11");
  const [deadline, setDeadline] = useState("2026-10-11T18:00");
  const [tracks, setTracks] = useState(initialTracks);
  const [prizes, setPrizes] = useState(initialPrizes);
  const [feedback, setFeedback] = useState("");
  const [feedbackKind, setFeedbackKind] = useState<"success" | "error">("success");
  const [pending, setPending] = useState(false);

  function updateTrack(id: number, field: "name" | "description", value: string) { setTracks((current) => current.map((track) => track.id === id ? { ...track, [field]: value } : track)); }
  function updatePrize(id: number, field: "name" | "amount" | "description", value: string) { setPrizes((current) => current.map((prize) => prize.id === id ? { ...prize, [field]: value } : prize)); }
  function addTrack() { setTracks((current) => [...current, { id: Date.now(), name: "New track", description: "Describe what belongs in this track." }]); }
  function removeTrack(id: number) { setTracks((current) => current.filter((track) => track.id !== id)); }
  function addPrize() { setPrizes((current) => [...current, { id: Date.now(), name: "New prize", amount: "$0", description: "Add a short description." }]); }
  function removePrize(id: number) { setPrizes((current) => current.filter((prize) => prize.id !== id)); }

  async function saveChanges(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!eventName.trim() || !description.trim() || tracks.length === 0 || prizes.length === 0) {
      setFeedback("Add an event name, description, at least one track, and at least one prize."); setFeedbackKind("error"); return;
    }
    if (registrationStart > registrationEnd || hackathonStart > hackathonEnd || deadline.slice(0, 10) < hackathonEnd) {
      setFeedback("Check the event dates. Each range must be in order and the deadline cannot be before the event ends."); setFeedbackKind("error"); return;
    }
    setPending(true); setFeedback("");
    await new Promise((resolve) => window.setTimeout(resolve, 450));
    setPending(false); setFeedback("Changes saved in this preview. Nothing was sent or stored."); setFeedbackKind("success");
  }

  const feedbackClass = feedbackKind === "error" ? styles.feedbackError : styles.feedbackSuccess;
  const feedbackRole = feedbackKind === "error" ? "alert" : "status";

  return <form className={styles.editorLayout} noValidate onSubmit={saveChanges}>
    <div className={styles.formColumn}>
      <header className={styles.pageHeader}><div><p className={styles.eyebrow}><span /> DOGFOOD HACKATHON <i /> EVENT MANAGEMENT</p><h1>Manage your event.</h1><p>Keep the event details clear, current, and ready for builders.</p></div><span className={`${styles.statusBadge} ${status === "Published" ? styles.published : ""}`}><i /> {status}</span></header>
      <section className={styles.formSection} aria-labelledby="basics-title"><div className={styles.sectionHeading}><span>01</span><div><p>THE EVENT</p><h2 id="basics-title">Event basics</h2></div></div><div className={styles.fieldsGrid}><label className={styles.fieldWide}><span>Event name</span><input maxLength={80} onChange={(event) => setEventName(event.target.value)} value={eventName} /></label><label><span>Event status</span><select onChange={(event) => setStatus(event.target.value)} value={status}><option>Draft</option><option>Published</option></select></label><label className={styles.fieldWide}><span>Description</span><textarea maxLength={500} onChange={(event) => setDescription(event.target.value)} rows={4} value={description} /><small>{description.length}/500 characters</small></label></div></section>
      <section className={styles.formSection} aria-labelledby="dates-title"><div className={styles.sectionHeading}><span>02</span><div><p>MARK THE CALENDAR</p><h2 id="dates-title">Event dates</h2></div></div><div className={styles.fieldsGrid}><label><span>Registration starts</span><input onChange={(event) => setRegistrationStart(event.target.value)} type="date" value={registrationStart} /></label><label><span>Registration ends</span><input onChange={(event) => setRegistrationEnd(event.target.value)} type="date" value={registrationEnd} /></label><label><span>Hackathon starts</span><input onChange={(event) => setHackathonStart(event.target.value)} type="date" value={hackathonStart} /></label><label><span>Hackathon ends</span><input onChange={(event) => setHackathonEnd(event.target.value)} type="date" value={hackathonEnd} /></label><label className={styles.fieldWide}><span>Submission deadline</span><input onChange={(event) => setDeadline(event.target.value)} type="datetime-local" value={deadline} /></label></div></section>
      <section className={styles.formSection} aria-labelledby="tracks-title">
        <div className={styles.sectionHeading}><span>03</span><div><p>MAKE A LANE</p><h2 id="tracks-title">Tracks</h2></div><button className={styles.addButton} onClick={addTrack} type="button"><Icon name="plus" size={14} /> Add track</button></div>
        {tracks.length > 0 ? (
          <div className={styles.repeatList}>
            {tracks.map((track, index) => (
              <div className={styles.repeatItem} key={track.id}>
                <span className={styles.itemNumber}>{String(index + 1).padStart(2, "0")}</span>
                <div className={styles.repeatFields}>
                  <label><span>Track name</span><input onChange={(event) => updateTrack(track.id, "name", event.target.value)} value={track.name} /></label>
                  <label><span>Description</span><textarea onChange={(event) => updateTrack(track.id, "description", event.target.value)} rows={2} value={track.description} /></label>
                </div>
                <button aria-label={`Remove ${track.name}`} className={styles.removeButton} onClick={() => removeTrack(track.id)} type="button"><Icon name="close" size={14} /></button>
              </div>
            ))}
          </div>
        ) : <div className={styles.inlineEmpty}><p>No tracks yet.</p><button onClick={addTrack} type="button">Add the first track <Icon name="plus" size={14} /></button></div>}
      </section>
      <section className={styles.formSection} aria-labelledby="prizes-title">
        <div className={styles.sectionHeading}><span>04</span><div><p>MAKE IT COUNT</p><h2 id="prizes-title">Prizes</h2></div><button className={styles.addButton} onClick={addPrize} type="button"><Icon name="plus" size={14} /> Add prize</button></div>
        {prizes.length > 0 ? (
          <div className={styles.repeatList}>
            {prizes.map((prize, index) => (
              <div className={styles.repeatItem} key={prize.id}>
                <span className={styles.itemNumber}>{String(index + 1).padStart(2, "0")}</span>
                <div className={styles.repeatFields}>
                  <div className={styles.fieldsGrid}><label><span>Prize name</span><input onChange={(event) => updatePrize(prize.id, "name", event.target.value)} value={prize.name} /></label><label><span>Amount</span><input onChange={(event) => updatePrize(prize.id, "amount", event.target.value)} value={prize.amount} /></label></div>
                  <label><span>Description</span><textarea onChange={(event) => updatePrize(prize.id, "description", event.target.value)} rows={2} value={prize.description} /></label>
                </div>
                <button aria-label={`Remove ${prize.name}`} className={styles.removeButton} onClick={() => removePrize(prize.id)} type="button"><Icon name="close" size={14} /></button>
              </div>
            ))}
          </div>
        ) : <div className={styles.inlineEmpty}><p>No prizes yet.</p><button onClick={addPrize} type="button">Add the first prize <Icon name="plus" size={14} /></button></div>}
      </section>
      <div className={styles.formActions}>
        <button className={styles.cancelButton} onClick={() => window.history.back()} type="button">Cancel</button>
        <button className={styles.saveButton} disabled={pending} type="submit">{pending ? "Saving changes..." : "Save Changes"} {!pending && <Icon name="check" size={14} />}</button>
      </div>
      {feedback && <p className={`${styles.feedback} ${feedbackClass}`} role={feedbackRole}><Icon name={feedbackKind === "error" ? "close" : "check"} size={15} /> {feedback}</p>}
    </div>
    <aside className={styles.previewColumn}>
      <section className={styles.previewCard}>
        <p className={styles.sectionEyebrow}>EVENT PREVIEW</p>
        <div className={styles.previewArtwork}><span>D</span><small>FALL 2026</small></div>
        <h2>{eventName || "Your event name"}</h2>
        <p>{description || "Your event description will appear here."}</p>
        <div className={styles.previewMeta}><span><Icon name="calendar" size={13} /> Oct 9–11, 2026</span><span><Icon name="people" size={13} /> 248 builders</span></div>
      </section>
      <section className={styles.previewCard}>
        <p className={styles.sectionEyebrow}>PUBLISHED TRACKS</p>
        <div className={styles.previewList}>
          {tracks.length > 0 ? tracks.map((track) => <span key={track.id}><i />{track.name}</span>) : <small>No tracks added yet.</small>}
        </div>
        <div className={styles.previewPrizes}><strong>{prizes.length}</strong><span>prizes configured</span></div>
      </section>
      <p className={styles.previewNote}><span /> Frontend preview only. Organizer services are not connected.</p>
    </aside>
  </form>;
}