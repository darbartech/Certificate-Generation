"use client";

import { ReactNode, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { AdminUser } from "@/lib/types";
import apiClient from "@/lib/api/client";
import { Logo, Icon, type IconName } from "@/components/ui";

const NAV_ITEMS: Array<{ href: string; label: string; icon: IconName; exact?: boolean }> = [
  { href: "/admin", label: "Dashboard", icon: "dashboard", exact: true },
  { href: "/admin/certificates", label: "Certificates", icon: "certificate" },
  { href: "/admin/certificates/new", label: "New Certificate", icon: "plus", exact: true },
  { href: "/admin/courses", label: "Courses", icon: "courses" },
  { href: "/admin/signatories", label: "Signatories", icon: "users" },
  { href: "/verify", label: "Verify Certificate", icon: "verify" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [degraded, setDegraded] = useState(false);
  const [healthChecked, setHealthChecked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  const isActive = (link: (typeof NAV_ITEMS)[number]): boolean => {
    if (link.exact) return pathname === link.href;
    return pathname === link.href || (pathname?.startsWith(link.href) && link.href.length > 3);
  };

  const handleLogout = async () => {
    localStorage.removeItem("dt_admin");
    setUser(null);
    setMenuOpen(false);
    try {
      await apiClient.logout();
    } catch {}
    router.push("/admin/login");
  };

  if (pathname === "/admin/login") {
    return children;
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-surface-muted to-white">
        <div className="text-center animate-fade-in">
          <Logo size={44} showWordmark={false} />
          <span className="spinner mt-5 border-2 border-brand-navy border-t-transparent w-6 h-6"></span>
          <p className="mt-3 text-sm text-gray-500">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  const initials = user.username.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-surface-muted">
      <header className="bg-white/95 backdrop-blur border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6 min-w-0">
            <Link href="/admin" className="flex items-center gap-2.5 shrink-0">
              <Logo size={34} showWordmark={false} />
              <span className="hidden lg:flex flex-col leading-none">
                <span className="text-[15px] font-bold tracking-tight">
                  <span className="text-brand-navy">Darbar</span>
                  <span className="text-brand-blue">Tech</span>
                </span>
                <span className="mt-1 text-[9px] font-medium uppercase tracking-[0.2em] text-gray-400">
                  Admin Panel
                </span>
              </span>
            </Link>

            <nav className="hidden md:flex items-end h-16 -mb-px" aria-label="Main">
              {NAV_ITEMS.map((link) => (
                <span key={link.href} className="relative h-full flex items-center">
                  <Link
                    href={link.href}
                    className={`relative h-full px-3 inline-flex items-center gap-1.5 text-sm transition-colors duration-150 ${
                      isActive(link)
                        ? "text-brand-navy font-semibold"
                        : "text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    <Icon name={link.icon} size={16} />
                    <span className="whitespace-nowrap">{link.label}</span>
                    <span
                      aria-hidden="true"
                      className={`absolute inset-x-3 bottom-0 h-0.5 rounded-t-full bg-brand-cyan transition-opacity duration-150 ${
                        isActive(link) ? "opacity-100" : "opacity-0"
                      }`}
                    />
                  </Link>
                </span>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {healthChecked && degraded ? (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                Degraded mode
              </span>
            ) : healthChecked ? (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Online
              </span>
            ) : null}

            {/* User menu */}
            {user && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  className="flex items-center gap-2.5 rounded-lg py-1.5 pl-1.5 pr-2 hover:bg-slate-100 transition-colors"
                >
                  <span className="w-8 h-8 rounded-full bg-brand-navy flex items-center justify-center">
                    <span className="text-sm font-bold text-white">{initials}</span>
                  </span>
                  <span className="hidden sm:block text-left leading-tight">
                    <span className="block text-sm font-medium text-gray-900">{user.username}</span>
                    <span className="block text-xs text-gray-500 capitalize">
                      {user.role.replace("_", " ")}
                    </span>
                  </span>
                  <Icon name="chevron-down" size={14} className="text-gray-400" />
                </button>

                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                    <div
                      role="menu"
                      className="absolute right-0 z-50 mt-2 w-60 origin-top-right rounded-lg border border-gray-200 bg-white shadow-pop animate-scale-in"
                    >
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-sm font-semibold text-gray-900">{user.username}</p>
                        <p className="text-xs text-gray-500 mt-0.5 capitalize">{user.role.replace("_", " ")}</p>
                      </div>
                      <div className="p-1.5">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => handleLogout()}
                          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Icon name="logout" size={16} />
                          Logout
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setMobileOpen((o) => !o)}
              className="md:hidden p-2 text-gray-600 hover:bg-slate-100 rounded-md"
              aria-label="Toggle navigation"
              aria-expanded={mobileOpen}
            >
              <Icon name="menu" size={20} />
            </button>
          </div>
        </div>

        {mobileOpen && (
          <nav className="md:hidden border-t border-gray-200 bg-white px-4 py-3 space-y-1 animate-fade-in" aria-label="Mobile">
            {NAV_ITEMS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  isActive(link) ? "bg-brand-navy/8 text-brand-navy font-semibold" : "text-gray-600 hover:bg-slate-100"
                }`}
              >
                <Icon name={link.icon} size={17} />
                {link.label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      {healthChecked && degraded && (
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div
            role="alert"
            className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm flex items-center justify-between gap-4 animate-fade-in"
          >
            <p className="text-amber-900">
              <span className="font-semibold">Running in degraded/offline mode</span>
              <span className="text-amber-800">
                {" "}— certificates issued now will not be saved permanently. Contact engineering.
              </span>
            </p>
            <button
              type="button"
              onClick={() => { void checkHealth(); }}
              className="shrink-0 text-xs font-medium text-amber-800 underline underline-offset-2 hover:text-amber-950 whitespace-nowrap"
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