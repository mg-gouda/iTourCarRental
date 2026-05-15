import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import type { SessionUserDto } from '@car-rental/shared-types';

/**
 * Auth.js is used ONLY as a JWT/session store on the Next.js side.
 * The actual authentication happens in the browser — the login page calls
 * the backend API directly so the browser receives the `sid` httpOnly cookie.
 * The user object returned by the backend is then passed here as `_user`
 * so Auth.js can persist it in its own JWT (used by middleware + useSession).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        // The login page serialises the full SessionUserDto here after a
        // successful direct fetch to the backend.
        _user: { label: 'Encoded user', type: 'text' },
      },
      async authorize({ _user }) {
        if (!_user || typeof _user !== 'string') return null;
        try {
          const user = JSON.parse(_user) as SessionUserDto;
          return {
            ...user,
            name: user.fullName,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) Object.assign(token, user);
      return token;
    },
    async session({ session, token }) {
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
    maxAge: 7 * 24 * 60 * 60,
  },
  trustHost: true,
});
