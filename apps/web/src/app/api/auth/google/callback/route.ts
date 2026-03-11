import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code  = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/login?error=oauth_cancelled", req.url));
  }

  // Exchange code for tokens
  const redirectUri = `${process.env.APP_URL}/api/auth/google/callback`;

  let tokenRes: Response;
  try {
    tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id:     process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri:  redirectUri,
        grant_type:    "authorization_code",
      }),
    });
  } catch {
    return NextResponse.redirect(new URL("/login?error=google_token_failed", req.url));
  }

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL("/login?error=google_token_failed", req.url));
  }

  const tokenData = (await tokenRes.json()) as { access_token?: string };
  const accessToken = tokenData.access_token;
  if (!accessToken) {
    return NextResponse.redirect(new URL("/login?error=google_token_failed", req.url));
  }

  // Fetch user info from Google
  let userInfo: { sub: string; email: string; name: string } | null = null;
  try {
    const infoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (infoRes.ok) {
      userInfo = (await infoRes.json()) as { sub: string; email: string; name: string };
    }
  } catch {
    // fall through
  }

  if (!userInfo?.email) {
    return NextResponse.redirect(new URL("/login?error=google_no_email", req.url));
  }

  // Call backend to find-or-create user and get JWT
  let backendData: { success: boolean; data?: { token: string }; error?: string };
  try {
    const backendRes = await fetch(`${BACKEND_URL}/api/auth/google`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        email:    userInfo.email,
        name:     userInfo.name ?? userInfo.email,
        googleId: userInfo.sub,
      }),
    });
    backendData = (await backendRes.json()) as typeof backendData;
  } catch {
    return NextResponse.redirect(new URL("/login?error=backend_failed", req.url));
  }

  if (!backendData.success || !backendData.data?.token) {
    return NextResponse.redirect(new URL("/login?error=backend_failed", req.url));
  }

  // Set httpOnly JWT cookie
  const cookieStore = await cookies();
  cookieStore.set("token", backendData.data.token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     "/",
    maxAge:   60 * 60 * 24 * 7,
  });

  return NextResponse.redirect(new URL("/dashboard", req.url));
}
