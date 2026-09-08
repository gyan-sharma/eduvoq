import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <h1 className="text-4xl font-semibold tracking-tight text-stone-900">
        EduVoq
      </h1>
      <p className="mt-3 text-lg text-stone-600">Connecting Educators</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/sample-papers"
          className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 hover:bg-stone-50"
        >
          Sample papers
        </Link>
        <Link
          href="/resources"
          className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 hover:bg-stone-50"
        >
          Resource Corner
        </Link>
        <Link
          href="/login"
          className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 hover:bg-stone-50"
        >
          Log in
        </Link>
        <Link
          href="/register"
          className="rounded-md bg-emerald-800 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Join
        </Link>
      </div>
    </main>
  );
}
