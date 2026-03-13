import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/store/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Bot, Loader2 } from "lucide-react"
import { toast } from "sonner"

// Google Identity Services types
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void
          renderButton: (element: HTMLElement, config: any) => void
          prompt: () => void
        }
      }
    }
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

type LoginMode = "otp" | "password"

export function Login() {
  const navigate = useNavigate()
  const { login, loginWithPassword, sendOtp, verifyOtp, isAuthenticated } = useAuth()
  const [mode, setMode] = useState<LoginMode>("otp")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [otpCode, setOtpCode] = useState("")
  const [otpSent, setOtpSent] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/")
      return
    }

    // Load Google Identity Services
    const script = document.createElement("script")
    script.src = "https://accounts.google.com/gsi/client"
    script.async = true
    script.defer = true
    document.body.appendChild(script)

    script.onload = () => {
      if (window.google && GOOGLE_CLIENT_ID) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleLogin,
        })

        const buttonDiv = document.getElementById("google-signin-button")
        if (buttonDiv) {
          window.google.accounts.id.renderButton(buttonDiv, {
            theme: "outline",
            size: "large",
            width: 280,
            text: "signin_with",
          })
        }
      }
    }

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script)
      }
    }
  }, [isAuthenticated, navigate])

  // Countdown timer for OTP resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const handleGoogleLogin = async (response: any) => {
    try {
      await login(response.credential)
      toast.success("Login successful!")
      navigate("/")
    } catch (error) {
      console.error("Login error:", error)
      toast.error("Login failed. Please try again.")
    }
  }

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setIsLoading(true)
    try {
      await sendOtp(email)
      setOtpSent(true)
      setCountdown(60)
      toast.success("Verification code sent to your email")
    } catch (error: any) {
      console.error("Send OTP error:", error)
      toast.error(error.message || "Failed to send verification code")
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !otpCode) return

    setIsLoading(true)
    try {
      await verifyOtp(email, otpCode)
      toast.success("Login successful!")
      navigate("/")
    } catch (error: any) {
      console.error("Verify OTP error:", error)
      toast.error(error.message || "Invalid verification code")
    } finally {
      setIsLoading(false)
    }
  }

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return

    setIsLoading(true)
    try {
      await loginWithPassword(email, password)
      toast.success("Login successful!")
      navigate("/")
    } catch (error: any) {
      console.error("Login error:", error)
      toast.error(error.message || "Invalid credentials")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900">
            <Bot className="h-8 w-8 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl">AI Agent Manager</CardTitle>
            <CardDescription className="mt-2">
              Sign in to manage your AI agents and models
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {mode === "otp" ? (
            otpSent ? (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otp">Verification Code</Label>
                  <Input
                    id="otp"
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    required
                    autoFocus
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading || otpCode.length !== 6}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & Sign In"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => { setOtpSent(false); setOtpCode("") }}
                >
                  Use different email
                </Button>
              </form>
            ) : (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading || !email}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Verification Code"}
                </Button>
              </form>
            )
          ) : (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
              </Button>
            </form>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-zinc-500">Or continue with</span>
            </div>
          </div>

          <div className="flex justify-center">
            <div id="google-signin-button"></div>
          </div>
          
          {!GOOGLE_CLIENT_ID && (
            <div className="rounded-md bg-yellow-50 p-4 text-sm text-yellow-800">
              ⚠️ Google Client ID not configured. Please set VITE_GOOGLE_CLIENT_ID in your environment.
            </div>
          )}

          <div className="text-center text-sm">
            <button
              type="button"
              onClick={() => { setMode(mode === "otp" ? "password" : "otp"); setOtpSent(false) }}
              className="text-zinc-500 hover:text-zinc-900 underline"
            >
              {mode === "otp" ? "Sign in with password" : "Sign in with email code"}
            </button>
          </div>

          <div className="text-center text-xs text-zinc-500">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
