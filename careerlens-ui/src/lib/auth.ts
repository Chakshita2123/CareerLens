import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (account && user) {
        // Prefer Google sub (providerAccountId), fall back to user.id or email
        token.sub = account.providerAccountId || user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        // Populate user.id with the verified Google account ID (sub) or email
        session.user.id = (token.sub as string) || session.user.email || ''
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
}
