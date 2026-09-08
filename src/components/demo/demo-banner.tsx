import Link from "next/link";

export function DemoBanner({ surface }: { surface: string }) {
  return (
    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
      Demo mode is on. This {surface} is sample content so you can see how
      EduVoq looks. An administrator can turn it off in{" "}
      <Link href="/admin/flags" className="font-medium underline">
        Admin → Flags
      </Link>
      .
    </p>
  );
}
