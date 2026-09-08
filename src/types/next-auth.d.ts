import type { Role, UserStatus } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: Role;
      status: UserStatus;
      tokenVersion: number;
      username: string | null;
    };
  }

  interface User {
    role?: Role;
    status?: UserStatus;
    tokenVersion?: number;
    username?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
    status?: UserStatus;
    tokenVersion?: number;
    username?: string | null;
  }
}
