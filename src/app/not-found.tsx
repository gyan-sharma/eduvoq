import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="mx-auto flex w-full max-w-lg flex-col items-center px-6 py-24 text-center">
      <p className="text-sm font-medium tracking-wide text-primary uppercase">
        404
      </p>
      <h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight">
        Page not found
      </h1>
      <p className="mt-3 text-muted-foreground">
        This page isn&apos;t on EduVoq — or it hasn&apos;t been published yet.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button asChild>
          <Link href="/">Back to home</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/contact">Contact us</Link>
        </Button>
      </div>
    </section>
  );
}
