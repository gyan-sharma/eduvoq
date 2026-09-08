import { CmsDocument } from "@/components/cms-document";
import { cmsPageMetadata } from "@/server/cms";

export const dynamic = "force-dynamic";
export const generateMetadata = cmsPageMetadata("about");

export default function AboutPage() {
  return <CmsDocument slug="about" />;
}
