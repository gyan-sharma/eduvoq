import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";
import Facebook from "next-auth/providers/facebook";
import LinkedIn from "next-auth/providers/linkedin";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import { Role, UserStatus } from "@prisma/client";
import { prisma } from "@/server/db";
import { generateUsername } from "@/lib/username";
import { verifyPassword } from "@/lib/password";
import { loginSchema } from "@/lib/validators/auth";
import { sessionCookieDomain, sessionCookieName } from "@/lib/auth-cookie";

const base = PrismaAdapter(prisma);

const adapter: Adapter = {
  ...base,
  createUser: async (data) => {
    if (!data.email) {
      throw new Error("OAuth profile is missing an email");
    }
    const username = await generateUsername(data.name, data.email);
    const created = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        // Auth.js passes emailVerified: null; OAuth email is provider-verified.
        emailVerified: data.emailVerified ?? new Date(),
        image: data.image,
        username,
        // OAuth never collected DOB; complete-profile is required on every social path.
        status: UserStatus.PENDING_PROFILE,
        role: Role.EDUCATOR,
      },
    });
    return created as AdapterUser;
  },
};

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  adapter,
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 14 },
  cookies: {
    sessionToken: {
      name: sessionCookieName(),
      options: {
        domain: sessionCookieDomain(),
        sameSite: "lax",
        path: "/",
        secure: (process.env.AUTH_URL ?? "").startsWith("https://"),
        httpOnly: true,
      },
    },
  },
  pages: {
    signIn: "/login",
    verifyRequest: "/verify-email",
    newUser: "/complete-profile",
  },
  providers: [
    Google({
      allowDangerousEmailAccountLinking: false,
      authorization: { params: { scope: "openid email profile" } },
    }),
    Apple({
      allowDangerousEmailAccountLinking: false,
    }),
    Facebook({
      allowDangerousEmailAccountLinking: false,
      authorization: { params: { scope: "email public_profile" } },
    }),
    LinkedIn({
      allowDangerousEmailAccountLinking: false,
      authorization: { params: { scope: "openid profile email" } },
    }),
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (raw) => {
        const parsed = loginSchema.safeParse({
          email: raw?.email,
          password: raw?.password,
        });
        if (!parsed.success) return null;
        const email = parsed.data.email.toLowerCase();
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;
        const valid = await verifyPassword(user.passwordHash, parsed.data.password);
        if (!valid) return null;
        if (
          user.status === UserStatus.BANNED ||
          user.status === UserStatus.SUSPENDED
        ) {
          return null;
        }
        if (user.status === UserStatus.PENDING_VERIFICATION) return null;
        if (!user.emailVerified && user.status !== UserStatus.PENDING_PROFILE) {
          return null;
        }
        if (
          user.status !== UserStatus.ACTIVE &&
          user.status !== UserStatus.PENDING_PROFILE
        ) {
          return null;
        }
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          status: user.status,
          username: user.username,
          tokenVersion: user.tokenVersion,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const id = user.id;
        if (!id) return token;
        token.id = id;
        const db = await prisma.user.findUnique({
          where: { id },
          select: {
            role: true,
            username: true,
            status: true,
            tokenVersion: true,
          },
        });
        if (db) {
          token.role = db.role;
          token.username = db.username;
          token.status = db.status;
          token.tokenVersion = db.tokenVersion;
        } else {
          token.role = user.role;
          token.username = user.username ?? null;
          token.status = user.status;
          token.tokenVersion = user.tokenVersion ?? 0;
        }
        return token;
      }

      const id = (token.id as string | undefined) ?? token.sub;
      if (!id) return token;

      try {
        const db = await prisma.user.findUnique({
          where: { id },
          select: {
            role: true,
            username: true,
            status: true,
            tokenVersion: true,
          },
        });
        if (!db) return null;
        // tokenVersion is issued at sign-in and must stay sticky. Copying the DB
        // value here would make requireSession() never see a revokeSessions mismatch.
        if (db.tokenVersion !== Number(token.tokenVersion ?? 0)) {
          return null;
        }
        token.role = db.role;
        token.username = db.username;
        token.status = db.status;
      } catch {
        return token;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = String(token.id ?? "");
      session.user.role = token.role as Role;
      session.user.username = (token.username as string | null | undefined) ?? null;
      session.user.status = token.status as UserStatus;
      session.user.tokenVersion = Number(token.tokenVersion ?? 0);
      return session;
    },
    async signIn({ user, account }) {
      if (!account || account.provider === "credentials") return true;
      if (!user.email) return false;
      const existing = await prisma.user.findUnique({
        where: { email: user.email },
        include: { accounts: true },
      });
      if (
        existing &&
        !existing.accounts.some((row) => row.provider === account.provider)
      ) {
        // Anonymous same-email OAuth is blocked; an already-signed-in user
        // may link this provider onto their own row (Auth.js linkAccount).
        const session = await auth();
        if (session?.user?.id === existing.id) return true;
        return "/login?error=LinkRequired";
      }
      return true;
    },
  },
});
