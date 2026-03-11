"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";

export type LoginState = {
  error?: string;
  step?: "verify";
  email?: string;
} | null;

export async function sendOtpAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get("email") as string;
  if (!email) return { error: "请填写邮箱" };

  let data: { success: boolean; error?: string };
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/send-otp`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email }),
    });
    data = (await res.json()) as typeof data;
  } catch {
    return { error: "无法连接到服务器，请稍后重试" };
  }

  if (!data.success) return { error: data.error ?? "发送失败，请重试" };

  return { step: "verify", email };
}

export async function verifyOtpAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get("email") as string;
  const code  = formData.get("code")  as string;

  if (!email || !code) return { error: "请填写验证码", step: "verify", email };

  let data: { success: boolean; data?: { token: string }; error?: string };
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/verify-otp`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email, code }),
    });
    data = (await res.json()) as typeof data;
  } catch {
    return { error: "无法连接到服务器，请稍后重试", step: "verify", email };
  }

  if (!data.success || !data.data?.token) {
    return { error: data.error ?? "验证码错误或已过期", step: "verify", email };
  }

  const cookieStore = await cookies();
  cookieStore.set("token", data.data.token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     "/",
    maxAge:   60 * 60 * 24 * 7,
  });

  redirect("/dashboard");
}
