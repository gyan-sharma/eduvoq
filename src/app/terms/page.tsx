import { CmsDocument } from "@/components/cms-document";
import { cmsPageMetadata } from "@/server/cms";

export const dynamic = "force-dynamic";
export const generateMetadata = cmsPageMetadata("terms");

export default function TermsPage() {
  return <CmsDocument slug="terms" />;
}
