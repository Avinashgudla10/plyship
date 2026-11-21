import { NextResponse } from 'next/server';

// PlyShip Marketplace: homeowner interior leads for interior firms, at plyship.com/marketplace.
// The marketplace is a separate app (the "justleads" Vercel project). This forwards /marketplace/* to it, so
// buyers stay on plyship.com the whole time: same login, and payments go through plyship.com's Razorpay.
// The secret header tells the marketplace the request really came through plyship.com.
const ORIGIN = (process.env.MARKETPLACE_ORIGIN || 'https://plyship.in').replace(/\/+$/, '');

export function proxy(request) {
  const { pathname, search } = request.nextUrl;
  const target = new URL(pathname + search, ORIGIN);
  const headers = new Headers(request.headers);
  headers.set('x-plyship-proxy', process.env.MARKETPLACE_PROXY_SECRET || '');
  headers.set('x-forwarded-host', request.nextUrl.host);
  return NextResponse.rewrite(target, { request: { headers } });
}

export const config = {
  matcher: ['/marketplace', '/marketplace/:path*'],
};
