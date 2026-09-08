import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Header } from "@/components/header";
import "./globals.css";

export const metadata: Metadata = {
  title: "EduVoq — Connecting Educators",
  description:
    "A professional network and resource hub for school teachers and K-12 stakeholders.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-stone-50 antialiased">
        <Header />
        {children}
      </body>
    </html>
  );
}
