"use client";

import { ReactNode, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { AdminUser } from "@/lib/types";
import apiClient from "@/lib/api/client";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [degraded, setDegraded] = useState(false);
  const [healthChecked, setHealthChecked] = useState(false);

  const validateSession = useCallback(async (): Promise<boolean> => {
    const stored = localStorage.getItem("dt_admin");
    if (!stored) return false;
    try {
      const result = await apiClient.me();
      if (result.success && result.user) {
        setUser(result.user as AdminUser);
        localStorage.setItem("dt_admin", JSON.stringify(result.user));
        return true;
      }
    } catch {}
    localStorage.removeItem("dt_admin");
    setUser(null);
    return false;
  }, []);

  const checkHealth = useCallback(async (): Promise<void> => {
    try {
      const res = await apiClient.health();
      if (res.success && "degraded" in res) {
        setDegraded(Boolean((res as unknown as { degraded?: boolean }).degraded));
      }
    } catch {
      // Auth failure / network error on the health probe is handled by the
      // session flow; don't flash a banner for it.
    } finally {
      setHealthChecked(true);
    }
  }, []);

  useEffect(() => {
    if (pathname === "/admin/login") {
      setLoading(false);
      setHealthChecked(true);
      return;
    }

    let cancelled = false;

    const onAuthExpired = () => {
      localStorage.removeItem("dt_admin");
      setUser(null);
      router.push("/admin/login");
    };
    window.addEventListener("dt-auth-expired", onAuthExpired);

    const run = async () => {
      setLoading(true);
      const ok = await validateSession();
      if (cancelled) return;
      if (!ok) {
        router.push("/admin/login");
      }
      setLoading(false);
      if (ok) {
        await checkHealth();
      }
    };
    run();

    return () => {
      cancelled = true;
      window.removeEventListener("dt-auth-expired", onAuthExpired);
    };
  }, [pathname, router, validateSession, checkHealth]);

  if (pathname === "/admin/login") {
    return children;
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <span className="spinner border-2 border-brand-navy border-t-transparent w-8 h-8"></span>
          <p className="mt-4 text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  const navLinks = [
    { href: "/admin", label: "Dashboard", icon: "📊", exact: true },
    { href: "/admin/certificates", label: "Certificates", icon: "📄" },
    { href: "/admin/certificates/new", label: "New Certificate", icon: "➕" },
    { href: "/admin/courses", label: "Courses", icon: "🗂" },
    { href: "/admin/signatories", label: "Signatories", icon: "✍️" },
    { href: "/verify", label: "Verify Certificate", icon: "🔍" },
  ];

  const handleLogout = async () => {
    localStorage.removeItem("dt_admin");
    setUser(null);
    try {
      await apiClient.logout();
    } catch {}
    router.push("/admin/login");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md border-2 border-brand-navy flex items-center justify-center bg-gray-50">
                <span className="text-brand-navy font-bold text-sm">D</span>
              </div>
              <div>
                <span className="font-bold text-brand-navy text-sm">DarbarTech</span>
                <span className="text-xs text-gray-400 ml-2">Admin</span>
              </div>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    link.exact
                      ? pathname === link.href
                        ? "bg-brand-navy/10 text-brand-navy font-medium"
                        : "text-gray-600 hover:bg-gray-100"
                      : pathname === link.href ||
                        (link.href !== "/admin/certificates/new" && pathname?.startsWith(link.href) && link.href.length > 3)
                        ? "bg-brand-navy/10 text-brand-navy font-medium"
                        : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <span className="mr-1.5">{link.icon}</span>
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {user && (
              <div className="hidden sm:flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{user.username}</p>
                  <p className="text-xs text-gray-500 capitalize">
                    {user.role.replace("_", " ")}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-full bg-brand-navy/10 flex items-center justify-center">
                  <span className="text-sm font-bold text-brand-navy">
                    {user.username.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
            )}
            <button onClick={handleLogout} className="btn-secondary text-sm py-1.5 px-3">
              Logout
            </button>
          </div>
        </div>
      </header>

      {healthChecked && degraded && (
        <div className="bg-amber-50 border-b border-amber-200" role="alert">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4">
            <p className="text-sm text-amber-900">
              <span className="font-semibold">⚠ Running in degraded/offline mode</span>
              <span className="text-amber-800">
                {" "}— certificates issued now will not be saved permanently. Contact engineering.
              </span>
            </p>
            <button
              type="button"
              onClick={() => { void checkHealth(); }}
              className="text-xs font-medium text-amber-800 underline underline-offset-2 hover:text-amber-950 whitespace-nowrap"
            >
              Refresh status
            </button>
          </div>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</div>
    </div>
  );
}
