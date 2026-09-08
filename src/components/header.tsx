import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-emerald-950"
        >
          EduVoq
        </Link>
        <nav className="flex items-center gap-4 text-sm text-stone-700">
          <Link href="/consult" className="hover:text-emerald-800">
            Consult
          </Link>
          <Link href="/account/bookings" className="hover:text-emerald-800">
            Bookings
          </Link>
          <Link href="/account" className="hover:text-emerald-800">
            Account
          </Link>
          <Link href="/login" className="hover:text-emerald-800">
            Log in
          </Link>
          <Link
            href="/register"
            className="rounded-md bg-emerald-800 px-3 py-1.5 text-white hover:bg-emerald-700"
          >
            Join
          </Link>
        </nav>
      </div>
    </header>
  );
}
