export { default } from 'next-auth/middleware'

export const config = {
  matcher: [
    '/match/:path*',
    '/roles/:path*',
    '/improve/:path*',
    '/comparison/:path*',
    '/interview/:path*',
  ],
}
