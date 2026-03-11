import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000";

async function handler(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const backendPath = "/" + path.join("/");

  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const url = new URL(backendPath, BACKEND_URL);
  req.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v));

  // Use arrayBuffer to handle both JSON and multipart/form-data correctly
  const hasBody = req.method !== "GET" && req.method !== "HEAD" && req.method !== "DELETE";
  const body = hasBody ? await req.arrayBuffer() : undefined;
  // Only forward Content-Type when there's an actual body to send
  if (body && body.byteLength > 0) {
    const contentType = req.headers.get("content-type");
    if (contentType) headers["Content-Type"] = contentType;
  }

  const res = await fetch(url.toString(), {
    method: req.method,
    headers,
    body: body && body.byteLength > 0 ? Buffer.from(body) : undefined,
  });

  const data = await res.arrayBuffer();
  return new NextResponse(data, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
  });
}

export const GET    = handler;
export const POST   = handler;
export const PUT    = handler;
export const PATCH  = handler;
export const DELETE = handler;
