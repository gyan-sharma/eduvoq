import type { ReactNode } from "react";
import { ResourceNav } from "@/components/resources/resource-nav";

export default function ResourcesLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ResourceNav />
      {children}
    </>
  );
}
