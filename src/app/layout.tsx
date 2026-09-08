import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Source_Serif_4 } from "next/font/google";

import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { siteUrl } from "@/lib/site";
import { cn } from "@/lib/utils";

import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "EduVoq — Connecting Educators",
    template: "%s | EduVoq",
  },
  description:
    "A professional network and resource hub for school teachers and K-12 stakeholders.",
  openGraph: {
    type: "website",
    siteName: "EduVoq",
    locale: "en_IN",
  },
  alternates: {
    types: {
      "application/rss+xml": "/rss.xml",
    },
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en-IN"
      className={cn("font-sans", geist.variable, sourceSerif.variable)}
    >
      <body className="flex min-h-screen flex-col antialiased">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
