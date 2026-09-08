import Link from "next/link";

import { Button } from "@/components/ui/button";

export function ServiceCtas() {
  return (
    <div className="mt-10 flex flex-wrap gap-3">
      <Button asChild>
        <Link href="/contact">Contact us</Link>
      </Button>
      <Button variant="outline" asChild>
        <Link href="/consult">Book a consultation</Link>
      </Button>
    </div>
  );
}
