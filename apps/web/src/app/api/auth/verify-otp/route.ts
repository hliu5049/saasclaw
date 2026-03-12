import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";

export async function POST(req: NextRequest) {
  const { email, code } = (await req.json()) as { email: string; code: string };

  let data: { success: boolean; data?: { token: string }; error?: string };
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/verify-otp`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email, code }),
      signal:  AbortSignal.timeout(15_000),
    });
    data = (await res.json()) as typeof data;
    if (!data.success) {
      return NextResponse.json(data, { status: res.status });
    }
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    console.error("[verify-otp] fetch failed:", err);
    return NextResponse.json(
      { success: false, error: isTimeout ? "后端响应超时，请检查服务是否正常" : "无法连接到服务器" },
      { status: 500 },
    );
  }

  // Set httpOnly JWT cookie
  const cookieStore = await cookies();
  cookieStore.set("token", data.data!.token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     "/",
    maxAge:   60 * 60 * 24 * 7,
  });

  return NextResponse.json({ success: true });
}
