export type ProjectMember = {
  id: string;
  name: string;
  role: string;
  initials: string;
};

export type ProjectRecord = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  trackId: string;
  trackName: string;
  repositoryUrl: string;
  demoUrl: string;
  technologies: string[];
  teamName: string;
  teamMembers: ProjectMember[];
  updatedAt: string;
};

const civicSignal: ProjectRecord = {
  id: "civicsignal",
  name: "CivicSignal",
  tagline: "A better way to be heard locally.",
  description: "CivicSignal helps neighbors turn everyday observations into useful, actionable feedback for the people shaping their communities. Share an idea, follow its progress, and see the small changes adding up around you.",
  trackId: "community",
  trackName: "Community & civic tech",
  repositoryUrl: "https://github.com/hackforge/civicsignal",
  demoUrl: "https://civicsignal.example.com",
  technologies: ["Next.js", "TypeScript", "Open data", "Civic tech"],
  teamName: "Pixel Pioneers",
  teamMembers: [
    { id: "jordan", name: "Jordan Lee", role: "Team lead · Product design", initials: "JL" },
    { id: "maya", name: "Maya Kim", role: "Frontend developer", initials: "MK" },
    { id: "alex", name: "Alex Santos", role: "Data & research", initials: "AS" },
    { id: "sam", name: "Sam Rivera", role: "Community strategy", initials: "SR" },
  ],
  updatedAt: "September 27, 2026",
};

export function getMockProject(projectId: string): ProjectRecord | null {
  const normalizedId = projectId.toLowerCase();
  if (normalizedId === civicSignal.id || normalizedId === "demo-project") {
    return civicSignal;
  }
  return null;
}