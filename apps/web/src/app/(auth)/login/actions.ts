"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000";

async function setTokenCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set("token", token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     "/",
    maxAge:   60 * 60 * 24 * 7, // 7 days
  });
}

export async function registerAction(formData: FormData) {
  const name     = formData.get("name")     as string;
  const email    = formData.get("email")    as string;
  const password = formData.get("password") as string;

  if (!name || !email || !password) {
    return { error: "请填写所有字段" };
  }
  if (password.length < 6) {
    return { error: "密码至少 6 位" };
  }

  let data: { success: boolean; data?: { token: string }; error?: string };

  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ name, email, password }),
    });
    data = (await res.json()) as typeof data;
  } catch {
    return { error: "无法连接到服务器，请稍后重试" };
  }

  if (!data.success || !data.data?.token) {
    return { error: data.error ?? "注册失败，请重试" };
  }

  await setTokenCookie(data.data.token);
  redirect("/dashboard");
}

export async function loginAction(formData: FormData) {
  const email    = formData.get("email")    as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "请填写邮箱和密码" };
  }

  let data: { success: boolean; data?: { token: string }; error?: string };

  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email, password }),
    });
    data = (await res.json()) as typeof data;
  } catch {
    return { error: "无法连接到服务器，请稍后重试" };
  }

  if (!data.success || !data.data?.token) {
    return { error: data.error ?? "邮箱或密码错误" };
  }

  await setTokenCookie(data.data.token);
  redirect("/dashboard");
}
