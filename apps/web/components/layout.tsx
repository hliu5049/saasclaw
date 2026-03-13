import { Link, Outlet, useLocation } from "react-router-dom"
import { LayoutDashboard, Box, Bot, Settings, LogOut, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/store/auth"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const navItems = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Models",
    href: "/models",
    icon: Box,
  },
  {
    title: "Agents",
    href: "/agents",
    icon: Bot,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
]

export function Layout() {
  const location = useLocation()
  const { user, logout } = useAuth()

  return (
    <div className="flex min-h-screen w-full bg-zinc-50/50">
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-64 flex-col border-r border-zinc-200 bg-white sm:flex">
        <div className="flex h-14 items-center border-b border-zinc-200 px-6">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <Bot className="h-6 w-6" />
            <span>saasclaw</span>
          </Link>
        </div>
        <nav className="flex-1 overflow-auto py-4">
          <ul className="grid gap-1 px-4">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href || (item.href !== "/" && location.pathname.startsWith(item.href))
              return (
                <li key={item.href}>
                  <Link
                    to={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-zinc-100 text-zinc-900"
                        : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.title}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
        
        {/* User Menu */}
        <div className="border-t border-zinc-200 p-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-start gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-white text-sm font-medium">
                  {user?.name?.charAt(0).toUpperCase() || "U"}
                </div>
                <div className="flex flex-col items-start text-left">
                  <span className="text-sm font-medium">{user?.name}</span>
                  <span className="text-xs text-zinc-500">{user?.email}</span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
      <main className="flex-1 sm:pl-64">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
