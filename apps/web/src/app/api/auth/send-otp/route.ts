import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";

export async function POST(req: NextRequest) {
  const { email } = (await req.json()) as { email: string };

  try {
    const res  = await fetch(`${BACKEND_URL}/api/auth/send-otp`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email }),
      signal:  AbortSignal.timeout(15_000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    console.error("[send-otp] fetch failed:", err);
    return NextResponse.json(
      { success: false, error: isTimeout ? "后端响应超时，请检查服务是否正常" : "无法连接到服务器" },
      { status: 500 },
    );
  }
}
