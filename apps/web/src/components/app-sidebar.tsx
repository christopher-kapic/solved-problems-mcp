"use client";

import {
  BookOpen,
  FileText,
  FolderOpen,
  Key,
  LayoutDashboard,
  Menu,
  Settings,
  Share2,
  ShieldCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

import { ModeToggle } from "./mode-toggle";
import { Button } from "./ui/button";
import UserMenu from "./user-menu";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/solved-problems", label: "Solved Problems", icon: BookOpen },
  { href: "/groups", label: "Groups", icon: FolderOpen },
  { href: "/sharing", label: "Sharing", icon: Share2 },
  { href: "/api-keys", label: "API Keys", icon: Key },
  { href: "/drafts", label: "Drafts", icon: FileText },
  { href: "/docs/mcp-setup", label: "MCP Setup", icon: Settings },
] as const;

export default function AppSidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";

  return (
    <div className="flex h-svh overflow-hidden">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform md:static md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-3">
          <Link href="/dashboard" className="text-lg font-semibold">
            Solved Problems
          </Link>
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2">
          <ul className="space-y-1">
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || pathname.startsWith(href + "/");
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </Link>
                </li>
              );
            })}
            {isAdmin && (
              <li>
                <Link
                  href="/admin"
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    pathname === "/admin" || pathname.startsWith("/admin/")
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  Admin
                </Link>
              </li>
            )}
          </ul>
        </nav>

        <div className="border-t border-sidebar-border px-3 py-3">
          <div className="flex items-center justify-between">
            <UserMenu />
            <ModeToggle />
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <div className="flex items-center border-b px-4 py-2 md:hidden">
          <Button variant="ghost" size="icon-sm" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <span className="ml-3 text-lg font-semibold">Solved Problems</span>
        </div>

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
