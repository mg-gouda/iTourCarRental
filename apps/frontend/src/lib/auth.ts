import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import type { SessionUserDto } from '@car-rental/shared-types';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totpCode: z.string().optional(),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        totpCode: { label: '2FA Code', type: 'text' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://backend:4000/api/v1';

        try {
          const res = await fetch(`${apiUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: parsed.data.email,
              password: parsed.data.password,
              totpCode: parsed.data.totpCode,
            }),
            credentials: 'include',
          });

          if (!res.ok) return null;

          const body = (await res.json()) as SessionUserDto & {
            requires2fa?: boolean;
            challengeToken?: string;
          };

          // 2FA required — propagate upward for the UI to handle
          if (body.requires2fa) {
            throw new Error(`2FA_REQUIRED:${body.challengeToken ?? ''}`);
          }

          return {
            id: body.id,
            email: body.email,
            name: body.fullName,
            ...body,
          };
        } catch (err) {
          if (err instanceof Error && err.message.startsWith('2FA_REQUIRED')) {
            throw err; // re-throw so the sign-in page can react
          }
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Initial sign-in: persist the full SessionUserDto on the JWT
        Object.assign(token, user);
      }
      return token;
    },
    async session({ session, token }) {
      // Expose everything to the client session
      Object.assign(session.user, token);
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  trustHost: true,
});
