import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/store/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Bot } from "lucide-react"
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

export function Login() {
  const navigate = useNavigate()
  const { login, isAuthenticated } = useAuth()

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
      if (window.google) {
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
      document.body.removeChild(script)
    }
  }, [isAuthenticated, navigate])

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
          <div className="flex justify-center">
            <div id="google-signin-button"></div>
          </div>
          
          {!GOOGLE_CLIENT_ID && (
            <div className="rounded-md bg-yellow-50 p-4 text-sm text-yellow-800">
              ⚠️ Google Client ID not configured. Please set VITE_GOOGLE_CLIENT_ID in your environment.
            </div>
          )}

          <div className="text-center text-xs text-zinc-500">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
