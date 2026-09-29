"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "../../../lib/api";
import type { ProjectRecord } from "../../../projects/[projectId]/project-data";
import JudgeReviewForm from "./judge-review-form";

type ReviewData = {
  project: { id: string; title: string; tagline: string; summary: string; track: string; repositoryUrl: string; demoUrl: string; team?: { name: string } };
  assignment: { status: "assigned" | "in_progress" | "completed" };
  rubric: { id: string; name: string; description: string; weight: number; maxScore: number }[];
  scores: { criterionId: string; score: number; feedback?: string }[];
};

export default function JudgeReviewLoader({ projectId }: { projectId: string }) {
  const [data, setData] = useState<ReviewData | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { apiRequest<ReviewData>(`/api/judge/projects/${projectId}`).then(setData).catch(reason => setError(reason instanceof Error ? reason.message : "Review data could not be loaded.")); }, [projectId]);
  if (error) return <section role="alert"><p>{error}</p></section>;
  if (!data) return <p role="status">Loading assigned review…</p>;
  const project: ProjectRecord = { id: data.project.id, name: data.project.title, tagline: data.project.tagline, description: data.project.summary, trackId: "", trackName: data.project.track, repositoryUrl: data.project.repositoryUrl || "#", demoUrl: data.project.demoUrl || "#", technologies: [], teamName: data.project.team?.name || "HackForge team", teamMembers: [], updatedAt: "" };
  return <JudgeReviewForm project={project} criteria={data.rubric} existingScores={data.scores} completed={data.assignment.status === "completed"} />;
}
