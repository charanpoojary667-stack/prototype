import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AppFrame from "./app-frame";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HackForge | Build something together",
  description: "Your home for hackathons, teams, projects, and community-built ideas.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><AppFrame>{children}</AppFrame></body>
    </html>
  );
}
