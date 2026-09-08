import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/server/rbac";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Resource Corner | EduVoq",
  description:
    "Learning material, class notes, sample papers, and lesson plans for school educators.",
};

const CARDS = [
  {
    href: "/resources/learning-material",
    title: "Learning material",
    body: "Curated worksheets, notes, and classroom resources.",
  },
  {
    href: "/resources/class-notes",
    title: "Class notes",
    body: "Teacher-contributed notes organised by board, class, and subject.",
  },
  {
    href: "/resources/sample-papers",
    title: "Sample papers & lesson plans",
    body: "Examination guidance and lesson plans. Public titles live at /sample-papers.",
  },
];

export default async function ResourcesHubPage() {
  const user = await requireSession().catch(() => null);
  if (!user) redirect("/login");

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">
        Resource Corner
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">
        Syllabus and question papers
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-stone-600">
        A library for school teachers. Downloads of educator-only files require
        an active EDUCATOR, EXPERT, STAFF, or ADMIN account. The webinars pack
        does not unlock this library.
      </p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-3">
        {CARDS.map((card) => (
          <li key={card.href}>
            <Link
              href={card.href}
              className="block h-full rounded-xl border border-stone-200 bg-white p-5 hover:border-emerald-800"
            >
              <h2 className="font-semibold text-stone-900">{card.title}</h2>
              <p className="mt-2 text-sm text-stone-600">{card.body}</p>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-sm text-stone-600">
        Browsing sample-paper titles is public:{" "}
        <Link href="/sample-papers" className="text-emerald-800 hover:underline">
          Lesson Plans / sample papers
        </Link>
        .
      </p>
    </div>
  );
}
