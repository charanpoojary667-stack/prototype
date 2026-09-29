"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { apiBody, apiRequest } from "../../lib/api";
import { useSearchParams } from "next/navigation";
import styles from "./team.module.css";

type Team = { id: string; name: string; createdBy: string; memberIds: string[]; createdAt: string; members: { id: string; name: string }[] };
type EventInfo = { title: string; teamCapacity: number };
const loadTeams = (eventId: string) => apiRequest<{ teams: Team[] }>(`/api/teams?eventId=${encodeURIComponent(eventId)}`);

export default function TeamWorkspace() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get("eventId") || "demo-event";
  const [eventInfo, setEventInfo] = useState<EventInfo | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [teamName, setTeamName] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const code = new URLSearchParams(window.location.search).get("invite");
        if (code) {
          await apiRequest(`/api/invites/${encodeURIComponent(code)}/accept`, { method: "POST", body: apiBody({}) });
          window.history.replaceState({}, "", `/teams/demo-team?eventId=${encodeURIComponent(eventId)}`);
          setMessage("You joined the team.");
        }
        const [result, eventResult] = await Promise.all([loadTeams(eventId), apiRequest<{ event: EventInfo }>(`/api/events/${encodeURIComponent(eventId)}`)]);
        setEventInfo(eventResult.event);
        setTeam(result.teams[0] || null);
      } catch (reason) { setError(reason instanceof Error ? reason.message : "Sign in to manage your team."); }
    }
    void load();
  }, [eventId]);

  async function createTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    try {
      await apiRequest("/api/teams", { method: "POST", body: apiBody({ eventId, name: teamName }) });
      setTeamName(""); setTeam((await loadTeams(eventId)).teams[0] || null); setMessage("Your team was created.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Team creation failed."); }
    finally { setPending(false); }
  }

  async function createInvite() {
    if (!team) return;
    setPending(true); setError("");
    try {
      const result = await apiRequest<{ invite: { url: string } }>(`/api/teams/${team.id}/invite`, { method: "POST", body: apiBody({}) });
      setInviteUrl(`${window.location.origin}${result.invite.url}`); setMessage("Invite link created. Share it with a teammate.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Invite could not be created."); }
    finally { setPending(false); }
  }

  async function leaveTeam() {
    if (!team) return;
    setPending(true); setError("");
    try { await apiRequest(`/api/teams/${team.id}/leave`, { method: "POST", body: apiBody({}) }); setTeam(null); setMessage("You left the team."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "You could not leave this team."); }
    finally { setPending(false); }
  }

  if (!team && !error) return <section className={styles.membersPanel} aria-busy="true"><h1>Loading your team…</h1></section>;
  if (!team) return <section className={styles.membersPanel}>
    <p className={styles.teamEyebrow}>{eventInfo?.title || "EVENT"} · TEAM SPACE</p><h1>Create your team</h1>
    <p>Register for the event, then create a team to invite builders and start a project.</p>
    <form onSubmit={createTeam} className={styles.createTeamForm}>
      <label htmlFor="team-name">Team name</label><input id="team-name" maxLength={80} minLength={2} onChange={event => setTeamName(event.target.value)} required value={teamName} />
      <button className={styles.inviteMemberButton} disabled={pending} type="submit">{pending ? "Creating…" : "Create team"}</button>
    </form>
    {error && <p role="alert">{error} <Link href="/login">Sign in</Link> · <Link href={`/events/${eventId}`}>Register for the event</Link></p>}
    {message && <p role="status">{message}</p>}
  </section>;

  const maxMembers = eventInfo?.teamCapacity || 5;
  return <>
    <section className={styles.teamHeader}>
      <div><p className={styles.teamEyebrow}><span /> MY TEAM <i /> {eventInfo?.title || "EVENT"}</p><h1>{team.name}</h1><p className={styles.teamDescription}>Your team workspace. Invite members and build together.</p></div>
      <button className={styles.inviteMemberButton} disabled={pending || team.memberIds.length >= maxMembers} onClick={createInvite} type="button"><span>+</span> {pending ? "Working…" : "Invite member"}</button>
    </section>
    <section className={styles.teamOverview}>
      <div><span className={styles.cardEyebrow}>TEAM LEADER</span><h2>{team.members.find(member => member.id === team.createdBy)?.name || "Team leader"}</h2><p>Created {new Date(team.createdAt).toLocaleDateString()}</p></div>
      <div className={styles.capacityText}><span>TEAM CAPACITY</span><strong>{team.memberIds.length} / {maxMembers}</strong><p>{Math.max(0, maxMembers - team.memberIds.length)} spots available</p></div>
    </section>
    <section className={styles.membersPanel} aria-labelledby="members-title">
      <div className={styles.panelHeading}><div><span className={styles.cardEyebrow}>YOUR CREW</span><h2 id="members-title">Team members</h2></div><span className={styles.memberCount}>{team.memberIds.length} <span>MEMBERS</span></span></div>
      {team.members.map(member => <article className={styles.memberRow} key={member.id}><span className={styles.memberAvatar}>{member.name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase()}</span><span className={styles.memberDetails}><strong>{member.name}</strong><small>{member.id === team.createdBy ? "Team leader" : "Team member"}</small></span></article>)}
    </section>
    {inviteUrl && <section className={styles.invitePanel}><span className={styles.cardEyebrow}>TEAM INVITE LINK</span><label className={styles.inviteLabel} htmlFor="invite-url">Share this secure link</label><input className={styles.inviteInput} id="invite-url" readOnly value={inviteUrl} /><button className={styles.copyButton} onClick={() => navigator.clipboard.writeText(inviteUrl).then(() => setMessage("Invite link copied."), () => setError("Copy failed. Select and copy the invite link."))} type="button">Copy invite link</button></section>}
    <div className={styles.teamActionsRow}><Link className={styles.inviteMemberButton} href={`/projects/new?eventId=${encodeURIComponent(eventId)}`}>Create project</Link><button className={styles.leaveButton} disabled={pending} onClick={leaveTeam} type="button">Leave team</button></div>
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
  </>;
}
