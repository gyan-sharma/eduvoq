import type { Metadata } from "next";
import Link from "next/link";
import { Role, UserStatus } from "@prisma/client";

import { auth } from "@/auth";
import { BlogSubmitForm } from "@/components/blog-submit-form";
import { MarketingPage } from "@/components/marketing-page";
import { Button } from "@/components/ui/button";
import { canUseBlogDraftHelper } from "@/lib/ai/access";
import { isAiAvailable } from "@/lib/ai/enabled";
import { CONTACT_EMAIL } from "@/lib/nav";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const metadata: Metadata = {
  title: "Submit your blog",
  description:
    "Submit blog posts and articles to EduVoq for review. Published pieces appear after staff moderation.",
  alternates: { canonical: "/blog/submit" },
};

export default async function BlogSubmitPage() {
  const session = await auth();
  const user = session?.user;
  const canSubmit =
    user?.status === UserStatus.ACTIVE && user.role !== Role.STUDENT;
  const showBlogAi =
    canSubmit &&
    canUseBlogDraftHelper(
      user ? { role: user.role, status: user.status } : null,
    ) &&
    (await isAiAvailable());

  return (
    <MarketingPage
      title="Submit your blog"
      description="Send a draft to EduVoq for review. Staff publish accepted pieces to the public blog — nothing goes live automatically."
    >
      <p className="mb-8 text-base leading-7">
        You can also email{" "}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="font-medium text-primary hover:underline"
        >
          {CONTACT_EMAIL}
        </a>
        .
      </p>
      {canSubmit ? (
        <BlogSubmitForm aiAvailable={showBlogAi} />
      ) : user?.status === UserStatus.PENDING_PROFILE ? (
        <LoginCta
          title="Finish your profile first"
          body="We need a complete member profile before a post can go to review."
          href="/complete-profile"
          label="Complete profile"
        />
      ) : user?.role === Role.STUDENT ? (
        <p className="text-sm leading-6 text-muted-foreground">
          Student accounts cannot submit blog posts. Ask a parent or use an
          educator account.
        </p>
      ) : (
        <LoginCta
          title="Members can submit drafts"
          body="Log in to send an article for review. Public visitors can still email us."
          href={`/login?callbackUrl=${encodeURIComponent("/blog/submit")}`}
          label="Log in to submit"
        />
      )}
    </MarketingPage>
  );
}

function LoginCta({
  title,
  body,
  href,
  label,
}: {
  title: string;
  body: string;
  href: string;
  label: string;
}) {
  return (
    <div className="max-w-md rounded-xl border border-border bg-card p-6">
      <p className="font-heading text-lg font-semibold">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
      <Button className="mt-4" asChild>
        <Link href={href}>{label}</Link>
      </Button>
    </div>
  );
}
