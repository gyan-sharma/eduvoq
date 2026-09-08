import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AccountNav } from "@/components/account/account-nav";
import { getSessionUser } from "@/server/rbac";

export const dynamic = "force-dynamic";

export default async function AccountLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <>
      <div className="mx-auto w-full max-w-3xl px-4 pt-10">
        <AccountNav username={user.username} />
      </div>
      {children}
    </>
  );
}
