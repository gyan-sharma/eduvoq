import { CmsDocument } from "@/components/cms-document";
import { cmsPageMetadata } from "@/server/cms";

export const dynamic = "force-dynamic";
export const generateMetadata = cmsPageMetadata("careers");

export default function CareersPage() {
  return <CmsDocument slug="careers" />;
}
