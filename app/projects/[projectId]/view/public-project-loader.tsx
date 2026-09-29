"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "../../../lib/api";
import type { ProjectRecord } from "../project-data";
import PublicProjectView from "./public-project-view";

type ApiComment = { id: string; body: string; createdAt: string; author?: { id: string; name: string } };
type ApiProject = Omit<ProjectRecord, "id" | "name" | "description" | "trackName" | "technologies" | "teamName" | "teamMembers" | "updatedAt"> & {
  id: string; title: string; summary: string; track: string; tags: string[]; createdAt: string;
  team?: { id: string; name: string; members: { id: string; name: string }[] } | null;
  event?: { votingEnabled: boolean; resultsPublic: boolean };
};

export default function PublicProjectLoader({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [comments, setComments] = useState<ApiComment[]>([]);
  const [voteCount, setVoteCount] = useState<number | null>(null);
  const [votingEnabled, setVotingEnabled] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiRequest<{ project: ApiProject; comments: ApiComment[]; votes: number | null; hasVoted: boolean }>(`/api/projects/${projectId}`)
      .then(({ project: item, comments: nextComments, votes, hasVoted: voted }) => {
        setProject({
          id: item.id, name: item.title, tagline: item.tagline, description: item.summary,
          trackId: item.trackId || "", trackName: item.track,
          repositoryUrl: item.repositoryUrl, demoUrl: item.demoUrl, technologies: item.tags || [],
          teamName: item.team?.name || "HackForge team",
          teamMembers: (item.team?.members || []).map(member => ({ id: member.id, name: member.name, role: member.id === item.team?.members[0]?.id ? "Team member" : "Team member", initials: member.name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase() })),
          updatedAt: new Date(item.createdAt).toLocaleDateString(),
        });
        setComments(nextComments);
        setVoteCount(votes);
        setVotingEnabled(Boolean(item.event?.votingEnabled));
        setHasVoted(voted);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Project could not be loaded."));
  }, [projectId]);

  if (error) return <p role="alert">{error}</p>;
  if (!project) return <p role="status">Loading project…</p>;
  return <PublicProjectView project={project} comments={comments} voteCount={voteCount} votingEnabled={votingEnabled} hasVoted={hasVoted} onVote={() => setHasVoted(true)} onCommentsChange={setComments} />;
}
