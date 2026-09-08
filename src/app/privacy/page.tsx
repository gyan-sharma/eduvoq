import { CmsDocument } from "@/components/cms-document";
import { cmsPageMetadata } from "@/server/cms";

export const dynamic = "force-dynamic";
export const generateMetadata = cmsPageMetadata("privacy");

export default function PrivacyPage() {
  return <CmsDocument slug="privacy" />;
}
