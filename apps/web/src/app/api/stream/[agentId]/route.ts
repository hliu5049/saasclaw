import { type NextRequest } from "next/server";
import { cookies } from "next/headers";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000";

/**
 * GET /api/stream/[agentId]
 *
 * Thin SSE proxy: reads the httpOnly `token` cookie server-side and forwards
 * the backend's text/event-stream back to the browser without buffering.
 * The browser-facing EventSource never needs to know about the JWT.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(
      `${BACKEND_URL}/api/chat/${agentId}/stream?token=${encodeURIComponent(token)}`,
      {
        headers: { Accept: "text/event-stream" },
        // @ts-expect-error — Node 18 fetch supports this; prevents body buffering
        duplex: "half",
      },
    );
  } catch {
    return new Response("Gateway unreachable", { status: 503 });
  }

  if (!backendRes.ok || !backendRes.body) {
    return new Response("Stream unavailable", { status: backendRes.status });
  }

  return new Response(backendRes.body, {
    headers: {
      "Content-Type":      "text/event-stream",
      "Cache-Control":     "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      "Connection":        "keep-alive",
    },
  });
}
