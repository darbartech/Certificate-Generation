"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import apiClient from "@/lib/api/client";
import { Logo, Icon, Alert, Button } from "@/components/ui";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const check = async () => {
      const stored = localStorage.getItem("dt_admin");
      if (!stored) return;
      try {
        const res = await apiClient.me();
        if (res.success && res.user) {
          localStorage.setItem("dt_admin", JSON.stringify(res.user));
          router.replace("/admin/certificates");
        }
      } catch {}
    };
    check();
  }, [router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await apiClient.login(username.trim(), password);
      if (result.success && result.user) {
        localStorage.setItem("dt_admin", JSON.stringify(result.user));
        router.replace("/admin/certificates");
      } else {
        setError(result.error || (result.errors ? result.errors.join(", ") : "Login failed"));
      }
    } catch (err) {
      setError("Login error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center py-12 px-4 relative overflow-hidden bg-gradient-to-br from-brand-dark via-brand-navy to-brand-blue">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -right-32 w-96 h-96 rounded-full bg-brand-cyan/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -left-24 w-[28rem] h-[28rem] rounded-full bg-brand-gold/10 blur-3xl"
      />

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto mb-5 flex justify-center">
            <Logo size={56} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Darbar<span className="text-brand-cyan">Tech</span> Admin
          </h1>
          <p className="mt-2 font-display text-sm italic text-brand-cyan/80">
            Certificate issuance &amp; verification portal
          </p>
          <p className="eyebrow-rules mx-auto mt-4 justify-center text-white/50">
            Authorized Access
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/95 backdrop-blur shadow-pop">
          <div className="p-6 sm:p-7">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="label" htmlFor="username">
                  Username
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Icon name="user" size={16} />
                  </span>
                  <input
                    id="username"
                    type="text"
                    className="input pl-9"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    autoComplete="username"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="password">
                  Password
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Icon name="lock" size={16} />
                  </span>
                  <input
                    id="password"
                    type="password"
                    className="input pl-9"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {error && <Alert variant="error" title={error} />}

              <Button type="submit" block size="lg" loading={loading} disabled={!username || !password}>
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </div>

          <div className="border-t border-gray-100 bg-surface-muted/70 rounded-b-xl px-6 py-4">
            <p className="text-xs font-medium text-gray-600 mb-1.5">Demo Credentials</p>
            <div className="space-y-1 text-xs text-gray-500">
              <p>
                <span className="inline-flex w-24 font-semibold text-gray-700">Super Admin</span>
                <code className="font-mono bg-white border border-gray-200 rounded px-1.5 py-0.5">admin / admin123</code>
              </p>
              <p>
                <span className="inline-flex w-24 font-semibold text-gray-700">Staff</span>
                <code className="font-mono bg-white border border-gray-200 rounded px-1.5 py-0.5">staff / staff123</code>
              </p>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-white/50 mt-6 flex items-center justify-center gap-1.5">
          <Icon name="shield" size={13} />
          Secure admin access restricted to authorized personnel only.
        </p>
        <div className="text-center mt-3">
          <Link href="/verify" className="text-xs text-white/70 hover:text-white underline underline-offset-2">
            Verify a certificate
          </Link>
        </div>
      </div>
    </main>
  );
}