import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EduVoq — Connecting Educators",
  description:
    "A professional network and resource hub for school teachers and K-12 stakeholders.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
