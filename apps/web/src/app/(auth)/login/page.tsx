"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input }  from "@/components/ui/input";
import { Label }  from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();

  const [step,    setStep]    = useState<"email" | "code">("email");
  const [email,   setEmail]   = useState("");
  const [code,    setCode]    = useState("");
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/auth/send-otp", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email }),
      });
      const data = (await res.json()) as { success: boolean; error?: string };
      if (data.success) {
        setStep("code");
      } else {
        setError(data.error ?? "发送失败，请重试");
      }
    } catch {
      setError("无法连接到服务器，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/auth/verify-otp", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email, code }),
      });
      const data = (await res.json()) as { success: boolean; error?: string };
      if (data.success) {
        router.push("/dashboard");
      } else {
        setError(data.error ?? "验证码错误或已过期");
      }
    } catch {
      setError("无法连接到服务器，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4">
      <Card className="w-full max-w-sm border-gray-800 bg-gray-900">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-50">
            Enterprise OpenClaw
          </CardTitle>
          <CardDescription className="text-gray-400">
            企业级 AI Agent 管理平台
          </CardDescription>
        </CardHeader>

        <CardContent>
          {step === "email" ? (
            /* ── Step 1: enter email ───────────────────────────────── */
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-300">邮箱</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  className="border-gray-700 bg-gray-800 text-gray-50 placeholder:text-gray-500 focus-visible:ring-gray-500"
                />
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gray-50 text-gray-950 hover:bg-gray-200"
              >
                {loading ? "发送中…" : "获取验证码"}
              </Button>
            </form>
          ) : (
            /* ── Step 2: enter OTP ─────────────────────────────────── */
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <p className="text-sm text-gray-400">
                验证码已发送至{" "}
                <span className="font-medium text-gray-200">{email}</span>
              </p>

              <div className="space-y-2">
                <Label htmlFor="code" className="text-gray-300">验证码</Label>
                <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="6 位数字"
                  maxLength={6}
                  autoComplete="one-time-code"
                  autoFocus
                  required
                  className="border-gray-700 bg-gray-800 text-gray-50 placeholder:text-gray-500 focus-visible:ring-gray-500 text-center tracking-[0.5em] text-lg"
                />
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gray-50 text-gray-950 hover:bg-gray-200"
              >
                {loading ? "验证中…" : "登录"}
              </Button>

              <button
                type="button"
                onClick={() => { setStep("email"); setError(""); setCode(""); }}
                className="w-full text-sm text-gray-500 hover:text-gray-300 transition-colors"
              >
                重新输入邮箱
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
