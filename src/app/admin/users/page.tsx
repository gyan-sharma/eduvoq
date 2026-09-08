import type { Metadata } from "next";
import { Role, UserStatus } from "@prisma/client";

import { AdminFlash } from "@/components/admin/flash";
import { buttonClass, fieldClass, secondaryButtonClass } from "@/components/auth/ui";
import {
  banUser,
  grantExpertRole,
  revokeExpertRole,
  unbanUser,
} from "@/server/actions/admin";
import { requireStaffPage } from "@/server/admin";
import { prisma } from "@/server/db";

export const metadata: Metadata = { title: "Users | Admin" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; ok?: string; error?: string }>;
}) {
  const actor = await requireStaffPage();
  const { q: rawQ, ok, error } = await searchParams;
  const q = (rawQ ?? "").trim();
  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { email: { contains: q } },
            { username: { contains: q } },
            { name: { contains: q } },
          ],
        }
      : {},
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
        Users
      </h1>
      <p className="mt-1 text-sm text-stone-600">
        Ban takes effect on the next server action. Experts are admin-granted.
      </p>
      <div className="mt-4">
        <AdminFlash ok={ok} error={error} />
      </div>
      <form className="mt-4 flex gap-2" action="/admin/users">
        <input
          className={`${fieldClass} mt-0 max-w-sm`}
          name="q"
          defaultValue={q}
          placeholder="Search email, username, name"
        />
        <button className={`${secondaryButtonClass} w-auto`} type="submit">
          Search
        </button>
      </form>
      <div className="mt-6 overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-stone-200 text-stone-500">
            <tr>
              <th className="px-4 py-2 font-medium">User</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-stone-900">
                    {user.name ?? user.email}
                  </p>
                  <p className="text-stone-600">
                    {user.email}
                    {user.username ? ` · @${user.username}` : ""}
                  </p>
                </td>
                <td className="px-4 py-3">{user.role}</td>
                <td className="px-4 py-3">{user.status}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {user.status === UserStatus.BANNED ||
                    user.status === UserStatus.SUSPENDED ? (
                      <form action={unbanUser}>
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="q" value={q} />
                        <button className={`${secondaryButtonClass} w-auto`} type="submit">
                          Unban
                        </button>
                      </form>
                    ) : (
                      <form action={banUser}>
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="q" value={q} />
                        <button className={`${secondaryButtonClass} w-auto`} type="submit">
                          Ban
                        </button>
                      </form>
                    )}
                    {actor.role === Role.ADMIN && user.role === Role.EDUCATOR ? (
                      <form action={grantExpertRole}>
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="q" value={q} />
                        <button className={`${buttonClass} w-auto`} type="submit">
                          Grant EXPERT
                        </button>
                      </form>
                    ) : null}
                    {actor.role === Role.ADMIN && user.role === Role.EXPERT ? (
                      <form action={revokeExpertRole}>
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="q" value={q} />
                        <button className={`${secondaryButtonClass} w-auto`} type="submit">
                          Revoke EXPERT
                        </button>
                      </form>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 ? (
          <p className="px-4 py-6 text-sm text-stone-600">No users match.</p>
        ) : null}
      </div>
    </div>
  );
}
