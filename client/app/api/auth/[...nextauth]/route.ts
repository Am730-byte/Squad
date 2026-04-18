import NextAuth, { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import prisma from '../../../../lib/prisma'
import { isValidEmail } from '../../../../lib/validation'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // Only handle Google OAuth sign-ins
      if (account?.provider !== 'google') return true

      const email = user.email
      const name = user.name
      const image = user.image ?? null

      if (!email || !name) return false

      // Requirement 9.1: validate email format before persisting
      if (!isValidEmail(email)) {
        console.error('Sign-in rejected: invalid email format:', email)
        return false
      }

      // Requirement 9.2: validate name is non-empty and within 1-100 characters
      const trimmedName = name.trim()
      if (trimmedName.length === 0 || trimmedName.length > 100) {
        console.error('Sign-in rejected: invalid name length:', trimmedName.length)
        return false
      }

      try {
        // Upsert the user record in the database
        await prisma.user.upsert({
          where: { email },
          update: { name: trimmedName, image },
          create: { email, name: trimmedName, image },
        })
        return true
      } catch (error) {
        console.error('Failed to upsert user on sign-in:', error)
        return false
      }
    },

    async jwt({ token, account, profile }) {
      // On first sign-in, look up the database user ID by email
      if (account && profile && token.email) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: token.email },
            select: { id: true },
          })
          if (dbUser) {
            token.id = dbUser.id
          }
        } catch (error) {
          console.error('Failed to fetch user ID from database:', error)
        }
      }
      return token
    },

    async session({ session, token }) {
      if (session.user && token.id) {
        (session.user as any).id = token.id as string
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
