"use client";

import { useActionState, useEffect, useState } from "react";
import { sendOtpAction, verifyOtpAction, type LoginState } from "./actions";
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
  const [sendState,   sendAction,   sendPending]   =
    useActionState<LoginState, FormData>(sendOtpAction, null);
  const [verifyState, verifyAction, verifyPending] =
    useActionState<LoginState, FormData>(verifyOtpAction, null);

  // Track the current step and confirmed email in local state
  const [step,  setStep]  = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");

  // Advance to code step when send-otp succeeds
  useEffect(() => {
    if (sendState?.step === "verify" && sendState.email) {
      setEmail(sendState.email);
      setStep("code");
    }
  }, [sendState]);

  const error = step === "code"
    ? (verifyState?.error ?? (verifyState?.step === "verify" ? undefined : sendState?.error))
    : sendState?.error;

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
            <form action={sendAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-300">邮箱</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  className="border-gray-700 bg-gray-800 text-gray-50 placeholder:text-gray-500 focus-visible:ring-gray-500"
                />
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <Button
                type="submit"
                disabled={sendPending}
                className="w-full bg-gray-50 text-gray-950 hover:bg-gray-200"
              >
                {sendPending ? "发送中…" : "获取验证码"}
              </Button>
            </form>
          ) : (
            /* ── Step 2: enter OTP ─────────────────────────────────── */
            <form action={verifyAction} className="space-y-4">
              <input type="hidden" name="email" value={email} />

              <p className="text-sm text-gray-400">
                验证码已发送至{" "}
                <span className="font-medium text-gray-200">{email}</span>
              </p>

              <div className="space-y-2">
                <Label htmlFor="code" className="text-gray-300">验证码</Label>
                <Input
                  id="code"
                  name="code"
                  type="text"
                  inputMode="numeric"
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
                disabled={verifyPending}
                className="w-full bg-gray-50 text-gray-950 hover:bg-gray-200"
              >
                {verifyPending ? "验证中…" : "登录"}
              </Button>

              <button
                type="button"
                onClick={() => setStep("email")}
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
