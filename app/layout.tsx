import type { Metadata } from "next";
import AppFrame from "./app-frame";
import "./globals.css";

export const metadata: Metadata = {
  title: "HackForge | Build something together",
  description: "Your home for hackathons, teams, projects, and community-built ideas.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col"><AppFrame>{children}</AppFrame></body>
    </html>
  );
}
