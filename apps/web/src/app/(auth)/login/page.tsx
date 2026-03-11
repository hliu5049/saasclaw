"use client";

import { useActionState, useState } from "react";
import { loginAction, registerAction } from "./actions";
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

type ActionState = { error?: string } | null;

function wrap(action: (fd: FormData) => Promise<ActionState>) {
  return (_prev: ActionState, formData: FormData): Promise<ActionState> =>
    action(formData);
}

export default function LoginPage() {
  const [tab, setTab] = useState<"login" | "register">("login");

  const [loginState,    loginAction_,    loginPending]    = useActionState<ActionState, FormData>(wrap(loginAction),    null);
  const [registerState, registerAction_, registerPending] = useActionState<ActionState, FormData>(wrap(registerAction), null);

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

          {/* Tab switcher */}
          <div className="mt-4 flex rounded-lg border border-gray-700 p-0.5">
            <button
              type="button"
              onClick={() => setTab("login")}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                tab === "login"
                  ? "bg-gray-700 text-gray-50"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              登录
            </button>
            <button
              type="button"
              onClick={() => setTab("register")}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                tab === "register"
                  ? "bg-gray-700 text-gray-50"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              注册
            </button>
          </div>
        </CardHeader>

        <CardContent>
          {/* ── Login form ─────────────────────────────────────── */}
          {tab === "login" && (
            <form action={loginAction_} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email" className="text-gray-300">邮箱</Label>
                <Input
                  id="login-email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  className="border-gray-700 bg-gray-800 text-gray-50 placeholder:text-gray-500 focus-visible:ring-gray-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password" className="text-gray-300">密码</Label>
                <Input
                  id="login-password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className="border-gray-700 bg-gray-800 text-gray-50 placeholder:text-gray-500 focus-visible:ring-gray-500"
                />
              </div>

              {loginState?.error && (
                <p className="text-sm text-red-400">{loginState.error}</p>
              )}

              <Button
                type="submit"
                disabled={loginPending}
                className="w-full bg-gray-50 text-gray-950 hover:bg-gray-200"
              >
                {loginPending ? "登录中…" : "登录"}
              </Button>
            </form>
          )}

          {/* ── Register form ──────────────────────────────────── */}
          {tab === "register" && (
            <form action={registerAction_} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reg-name" className="text-gray-300">姓名</Label>
                <Input
                  id="reg-name"
                  name="name"
                  type="text"
                  placeholder="张三"
                  autoComplete="name"
                  required
                  className="border-gray-700 bg-gray-800 text-gray-50 placeholder:text-gray-500 focus-visible:ring-gray-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reg-email" className="text-gray-300">邮箱</Label>
                <Input
                  id="reg-email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  className="border-gray-700 bg-gray-800 text-gray-50 placeholder:text-gray-500 focus-visible:ring-gray-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reg-password" className="text-gray-300">密码</Label>
                <Input
                  id="reg-password"
                  name="password"
                  type="password"
                  placeholder="至少 6 位"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  className="border-gray-700 bg-gray-800 text-gray-50 placeholder:text-gray-500 focus-visible:ring-gray-500"
                />
              </div>

              {registerState?.error && (
                <p className="text-sm text-red-400">{registerState.error}</p>
              )}

              <Button
                type="submit"
                disabled={registerPending}
                className="w-full bg-blue-600 text-white hover:bg-blue-500"
              >
                {registerPending ? "注册中…" : "注册"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
