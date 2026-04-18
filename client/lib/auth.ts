import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import prisma from '@/lib/prisma'
import { isValidEmail } from '@/lib/validation'

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
    async signIn({ user, account }) {
      if (account?.provider !== 'google') return true

      const email = user.email
      const name = user.name
      const image = user.image ?? null

      if (!email || !name) return false

      if (!isValidEmail(email)) {
        console.error('Sign-in rejected: invalid email format:', email)
        return false
      }

      const trimmedName = name.trim()
      if (trimmedName.length === 0 || trimmedName.length > 100) {
        console.error('Sign-in rejected: invalid name length:', trimmedName.length)
        return false
      }

      try {
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

    async jwt({ token, account }) {
      if (account && token.email) {
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
        (session.user as { id?: string }).id = token.id as string
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
}
