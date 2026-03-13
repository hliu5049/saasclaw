import { useEffect } from "react"
import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "@/store/auth"
import { Loader2 } from "lucide-react"

export function ProtectedRoute() {
  const { isAuthenticated, isLoading, checkAuth } = useAuth()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
