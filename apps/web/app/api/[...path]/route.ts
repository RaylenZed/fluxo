import { type NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8090';

async function proxy(req: NextRequest, params: Promise<{ path: string[] }>) {
  const { path } = await params;
  const url = `${BACKEND}/api/${path.join('/')}${req.nextUrl.search}`;

  const rawBody = req.method !== 'GET' && req.method !== 'HEAD' ? await req.text() : undefined;
  const body = rawBody || undefined;

  // Forward auth-relevant headers to Fastify
  const headers: Record<string, string> = {};
  if (body) headers['content-type'] = 'application/json';
  const cookie = req.headers.get('cookie');
  if (cookie) headers['cookie'] = cookie;
  const authorization = req.headers.get('authorization');
  if (authorization) headers['authorization'] = authorization;

  const res = await fetch(url, { method: req.method, headers, body });
  const text = await res.text();

  // Forward Set-Cookie back to the browser
  const responseHeaders: Record<string, string> = {
    'content-type': res.headers.get('content-type') ?? 'application/json',
  };
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) responseHeaders['set-cookie'] = setCookie;

  return new NextResponse(text, { status: res.status, headers: responseHeaders });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, params);
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, params);
}
export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, params);
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, params);
}
