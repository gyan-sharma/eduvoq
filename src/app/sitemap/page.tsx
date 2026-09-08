import type { Metadata } from "next";
import Link from "next/link";

import { MarketingPage } from "@/components/marketing-page";
import { serviceGroups } from "@/lib/nav";

export const metadata: Metadata = {
  title: "Sitemap",
  description: "HTML sitemap of EduVoq public marketing pages.",
};

const generalLinks = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About Us" },
  { href: "/about#mission", label: "Mission" },
  { href: "/about#vision", label: "Vision" },
  { href: "/contact", label: "Contact" },
  { href: "/careers", label: "Careers" },
  { href: "/news", label: "News" },
  { href: "/pricing", label: "Plans & Pricing" },
  { href: "/consult", label: "Expert consultation" },
  { href: "/members", label: "Community Members" },
  { href: "/store", label: "Store" },
  { href: "/thank-you", label: "Thank you" },
];

const blogLinks = [
  { href: "/blog", label: "Blogs & Articles" },
  { href: "/blog/categories/e-magazine", label: "E-magazine" },
  { href: "/blog/submit", label: "Submit your blog" },
  { href: "/rss.xml", label: "RSS feed" },
];

const eventLinks = [{ href: "/events", label: "Events" }];

const legalLinks = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms and Conditions" },
  { href: "/sitemap", label: "Sitemap" },
];

function LinkList({
  items,
}: {
  items: Array<{ href: string; label: string }>;
}) {
  return (
    <ul className="mt-3 flex flex-col gap-2">
      {items.map((item) => (
        <li key={item.href}>
          {item.href.endsWith(".xml") ? (
            <a href={item.href} className="text-primary hover:underline">
              {item.label}
            </a>
          ) : (
            <Link href={item.href} className="text-primary hover:underline">
              {item.label}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function SitemapPage() {
  return (
    <MarketingPage
      title="Sitemap"
      description="Public marketing pages on EduVoq."
      className="max-w-5xl"
    >
      <div className="grid gap-10 sm:grid-cols-2">
        <section>
          <h2 className="font-heading text-lg font-semibold">General</h2>
          <LinkList items={generalLinks} />
        </section>
        <section>
          <h2 className="font-heading text-lg font-semibold">Blog</h2>
          <LinkList items={blogLinks} />
        </section>
        <section>
          <h2 className="font-heading text-lg font-semibold">Events</h2>
          <LinkList items={eventLinks} />
        </section>
        <section>
          <h2 className="font-heading text-lg font-semibold">Legal</h2>
          <LinkList items={legalLinks} />
        </section>
        <section className="sm:col-span-2">
          <h2 className="font-heading text-lg font-semibold">Services</h2>
          <ul className="mt-3">
            <li>
              <Link href="/services" className="text-primary hover:underline">
                All consulting services
              </Link>
            </li>
          </ul>
          <div className="mt-6 grid gap-8 sm:grid-cols-3">
            {serviceGroups.map((group) => (
              <div key={group.heading}>
                <h3 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
                  {group.heading}
                </h3>
                <LinkList items={group.items} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </MarketingPage>
  );
}
