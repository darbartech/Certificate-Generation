"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api/client";

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
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-xl border-2 border-brand-navy flex items-center justify-center bg-white shadow-sm mx-auto mb-4">
            <span className="text-brand-navy font-bold text-2xl">D</span>
          </div>
          <h1 className="text-2xl font-bold text-brand-navy">Admin Login</h1>
          <p className="text-sm text-gray-500 mt-2">
            DarbarTech Certificate Management System
          </p>
        </div>

        <div className="card">
          <div className="card-body">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="label" htmlFor="username">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  className="input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  autoComplete="username"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label className="label" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="btn-primary w-full py-2.5"
                disabled={loading || !username || !password}
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="spinner"></span>
                    Signing in...
                  </span>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>
          </div>
        </div>

        <div className="mt-6 p-4 rounded-lg bg-blue-50 border border-blue-100 text-sm text-blue-800">
          <p className="font-medium mb-1">Demo Credentials:</p>
          <ul className="space-y-0.5 text-xs text-blue-700">
            <li><strong>Super Admin:</strong> admin / admin123</li>
            <li><strong>Staff:</strong> staff / staff123</li>
          </ul>
        </div>

        <p className="text-center text-xs text-gray-500 mt-6">
          Secure admin access restricted to authorized personnel only.
        </p>
      </div>
    </main>
  );
}
