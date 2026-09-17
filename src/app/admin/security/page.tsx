"use client";

import { useCallback, useEffect, useState } from "react";
import { PERMISSION_KEYS, type AdminUser } from "@/lib/types";
import apiClient, { type AdminSessionView } from "@/lib/api/client";
import { Alert, Button, Card, CardBody, CardHeader, CardTitle, Icon, PageHeader } from "@/components/ui";

const ALL_PERMISSIONS = PERMISSION_KEYS;

export default function SecurityPage() {
  const [me, setMe] = useState<AdminUser | null>(null);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [setup, setSetup] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [code, setCode] = useState("");
  const [sessions, setSessions] = useState<AdminSessionView[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const notify = (tone: "success" | "error", text: string) => setMessage({ tone, text });

  const load = useCallback(async () => {
    const [meRes, mfaRes, sessRes] = await Promise.all([
      apiClient.me(),
      apiClient.mfaStatus(),
      apiClient.mySessions(),
    ]);
    if (meRes.success && meRes.user) setMe(meRes.user);
    if (mfaRes.success && mfaRes.data) setMfaEnabled(mfaRes.data.mfaEnabled);
    if (sessRes.success && sessRes.data) setSessions(sessRes.data.sessions);
    if (meRes.user?.role === "super_admin") {
      const adminsRes = await apiClient.listAdmins();
      if (adminsRes.success && adminsRes.data) setAdmins(adminsRes.data.admins);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const startEnroll = async () => {
    setBusy(true);
    setMessage(null);
    const res = await apiClient.mfaSetup();
    if (res.success && res.data) {
      setSetup(res.data);
      setCode("");
    } else {
      notify("error", res.error || "Could not start MFA setup.");
    }
    setBusy(false);
  };

  const confirmEnroll = async () => {
    if (!setup) return;
    setBusy(true);
    const res = await apiClient.mfaEnable(setup.secret, code);
    if (res.success) {
      setMfaEnabled(true);
      setSetup(null);
      setCode("");
      notify("success", "MFA enabled. You will be asked for a code at next login.");
    } else {
      notify("error", res.error || "Invalid code.");
    }
    setBusy(false);
  };

  const disableMfa = async () => {
    setBusy(true);
    const res = await apiClient.mfaDisable();
    if (res.success) {
      setMfaEnabled(false);
      notify("success", "MFA disabled.");
    } else {
      notify("error", res.error || "Could not disable MFA.");
    }
    setBusy(false);
  };

  const revokeAll = async () => {
    setBusy(true);
    const res = await apiClient.revokeMySessions();
    if (res.success) {
      notify("success", "All sessions revoked. You will be signed out on your next request.");
      setSessions([]);
    } else {
      notify("error", res.error || "Could not revoke sessions.");
    }
    setBusy(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account"
        title="Security"
        description="Multi-factor authentication, active sessions and admin accounts."
      />

      {message && <Alert variant={message.tone} title={message.text} />}

      <Card>
        <CardHeader>
          <CardTitle>Multi-factor authentication</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <p className="text-sm text-ink-muted">
            Protect your account with a TOTP authenticator app. Required for super admins in
            production deployments.
          </p>
          <p className="text-sm">
            Status:{" "}
            <span className={mfaEnabled ? "text-emerald-600 font-semibold" : "text-amber-600 font-semibold"}>
              {mfaEnabled ? "Enabled" : "Not enabled"}
            </span>
          </p>

          {!mfaEnabled && !setup && (
            <Button onClick={startEnroll} loading={busy}>
              Set up authenticator
            </Button>
          )}

          {setup && (
            <div className="space-y-3 rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-ink-muted">
                Add this secret to your authenticator app, then enter the 6-digit code below.
              </p>
              <code className="block break-all rounded bg-surface-muted px-3 py-2 font-mono text-xs">
                {setup.secret}
              </code>
              <code className="block break-all rounded bg-surface-muted px-3 py-2 font-mono text-[11px] text-ink-muted">
                {setup.otpauthUri}
              </code>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  className="input w-40 tracking-widest"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
                <Button onClick={confirmEnroll} loading={busy} disabled={code.length !== 6}>
                  Confirm
                </Button>
                <Button variant="ghost" onClick={() => setSetup(null)} disabled={busy}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {mfaEnabled && (
            <Button variant="danger" onClick={disableMfa} loading={busy}>
              Disable MFA
            </Button>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Active sessions</CardTitle>
          <Button variant="ghost" size="sm" onClick={revokeAll} disabled={busy || sessions.length === 0}>
            Sign out everywhere
          </Button>
        </CardHeader>
        <CardBody>
          {sessions.length === 0 ? (
            <p className="text-sm text-ink-muted">No active sessions.</p>
          ) : (
            <ul className="divide-y divide-gray-100 text-sm">
              {sessions.map((s) => (
                <li key={s.id} className="py-2.5 flex items-center justify-between gap-4">
                  <span className="min-w-0">
                    <span className="block text-ink truncate">{s.userAgent || "Unknown device"}</span>
                    <span className="block text-xs text-ink-faint">{s.ipAddress || "unknown IP"}</span>
                  </span>
                  <span className="text-xs text-ink-faint shrink-0">
                    Last seen {new Date(s.lastSeenAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {me?.role === "super_admin" && <AdminAccountsCard admins={admins} reload={load} notify={notify} />}
    </div>
  );
}

function AdminAccountsCard({
  admins,
  reload,
  notify,
}: {
  admins: AdminUser[];
  reload: () => Promise<void>;
  notify: (tone: "success" | "error", text: string) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AdminUser["role"]>("staff");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    const res = await apiClient.createAdmin({ username: username.trim(), password, role });
    if (res.success) {
      notify("success", `Admin "${username.trim()}" created.`);
      setUsername("");
      setPassword("");
      setRole("staff");
      await reload();
    } else {
      notify("error", res.error || (res.errors || []).join(", ") || "Could not create admin.");
    }
    setBusy(false);
  };

  const toggleActive = async (admin: AdminUser, active: boolean) => {
    setBusy(true);
    const res = await apiClient.updateAdmin(admin.id, { isActive: active });
    if (res.success) {
      notify("success", `${admin.username} ${active ? "enabled" : "disabled"}.`);
      await reload();
    } else {
      notify("error", res.error || "Could not update admin.");
    }
    setBusy(false);
  };

  const revoke = async (admin: AdminUser) => {
    setBusy(true);
    const res = await apiClient.revokeUserSessions(admin.id);
    if (res.success) {
      notify("success", `Revoked ${res.data?.revoked ?? 0} session(s) for ${admin.username}.`);
    } else {
      notify("error", res.error || "Could not revoke sessions.");
    }
    setBusy(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin accounts</CardTitle>
      </CardHeader>
      <CardBody className="space-y-5">
        <ul className="divide-y divide-gray-100 text-sm">
          {admins.map((admin) => (
            <li key={admin.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
              <span>
                <span className="block font-medium text-ink">{admin.username}</span>
                <span className="block text-xs text-ink-faint capitalize">
                  {admin.role.replace("_", " ")} · permissions:{" "}
                  {ALL_PERMISSIONS.filter((p) => admin.permissions?.[p]).join(", ") || "none"}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => revoke(admin)} disabled={busy}>
                  Revoke sessions
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => toggleActive(admin, true)}
                  disabled={busy}
                >
                  <Icon name="check" size={14} className="mr-1" /> Enable
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => toggleActive(admin, false)}
                  disabled={busy}
                >
                  Disable
                </Button>
              </span>
            </li>
          ))}
        </ul>

        <div className="rounded-lg border border-gray-200 p-4 space-y-3">
          <p className="text-sm font-semibold text-ink">Add admin</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              className="input"
              placeholder="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <input
              className="input"
              type="password"
              placeholder="password (12+ chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <select
              className="input"
              value={role}
              onChange={(e) => setRole(e.target.value as AdminUser["role"])}
            >
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
          <Button
            onClick={create}
            loading={busy}
            disabled={username.trim().length < 3 || password.length < 12}
          >
            Create admin
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
