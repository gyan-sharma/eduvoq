import Link from "next/link";
import { auth } from "@/auth";

export async function Header() {
  const session = await auth();
  const signedIn = Boolean(session?.user);

  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-emerald-950"
        >
          EduVoq
        </Link>
        <nav className="flex flex-wrap items-center gap-4 text-sm text-stone-700">
          <Link href="/store" className="hover:text-emerald-800">
            Store
          </Link>
          <Link href="/sample-papers" className="hover:text-emerald-800">
            Sample papers
          </Link>
          {signedIn ? (
            <>
              <Link href="/resources" className="hover:text-emerald-800">
                Resource Corner
              </Link>
              <Link href="/cart" className="hover:text-emerald-800">
                Cart
              </Link>
              <Link href="/account" className="hover:text-emerald-800">
                Account
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-emerald-800">
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-emerald-800 px-3 py-1.5 text-white hover:bg-emerald-700"
              >
                Join
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
