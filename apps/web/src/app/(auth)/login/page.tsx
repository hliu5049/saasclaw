"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";
import { Button }  from "@/components/ui/button";
import { Input }   from "@/components/ui/input";
import { Label }   from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ActionState = { error?: string } | null;

// Server Action signature is (_prevState: ActionState, formData: FormData) => …
async function wrappedLogin(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return loginAction(formData);
}

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    wrappedLogin,
    null,
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4">
      <Card className="w-full max-w-sm border-gray-800 bg-gray-900">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-50">
            Enterprise OpenClaw
          </CardTitle>
          <CardDescription className="text-gray-400">
            请登录以继续使用平台
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-300">
                邮箱
              </Label>
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

            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-300">
                密码
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="border-gray-700 bg-gray-800 text-gray-50 placeholder:text-gray-500 focus-visible:ring-gray-500"
              />
            </div>

            {state?.error && (
              <p className="text-sm text-red-400">{state.error}</p>
            )}

            <Button
              type="submit"
              disabled={pending}
              className="w-full bg-gray-50 text-gray-950 hover:bg-gray-200"
            >
              {pending ? "登录中…" : "登录"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
