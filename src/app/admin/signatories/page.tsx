"use client";

import { useEffect, useState, useCallback } from "react";
import apiClient from "@/lib/api/client";
import type { SignatoryRecord } from "@/lib/types";

export default function SignatoriesPage() {
  const [signatories, setSignatories] = useState<SignatoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SignatoryRecord | null>(null);
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiClient.listSignatories();
      if (result.success && result.data) {
        setSignatories(result.data as SignatoryRecord[]);
      }
    } catch {
      // Empty state handles the failure gracefully.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setPosition("");
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (signatory: SignatoryRecord) => {
    setEditing(signatory);
    setName(signatory.name);
    setPosition(signatory.position);
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    setFormError(null);
    const cleanName = name.trim();
    const cleanPosition = position.trim();
    if (!cleanName || !cleanPosition) {
      setFormError("Name and position are required.");
      return;
    }

    setSaving(true);
    try {
      const payload = { name: cleanName, position: cleanPosition };
      const result = editing
        ? await apiClient.updateSignatory(editing.id, payload)
        : await apiClient.createSignatory({ ...payload, active: true });
      if (!result.success) {
        setFormError(
          (result.errors && result.errors.join(" ")) || result.error || "Failed to save signatory."
        );
        return;
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save signatory.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (signatory: SignatoryRecord) => {
    setBusyId(signatory.id);
    try {
      await apiClient.updateSignatory(signatory.id, { active: !signatory.active });
      await load();
    } catch {
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const activeCount = signatories.filter((s) => s.active).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Signatories</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage the authorized signatories shown on issued certificates
          </p>
        </div>
        <button type="button" onClick={openCreate} className="btn-primary">
          <span className="mr-2">+</span> New Signatory
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card card-body">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Total</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{signatories.length}</p>
        </div>
        <div className="card card-body">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Active</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{activeCount}</p>
        </div>
        <div className="card card-body">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Inactive</p>
          <p className="text-2xl font-bold text-gray-600 mt-1">{signatories.length - activeCount}</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="card-header flex items-center justify-between gap-4">
          <h2 className="font-semibold text-gray-900">Signatory roster</h2>
          <p className="text-xs text-gray-400 whitespace-nowrap">
            {signatories.length} {signatories.length === 1 ? "signatory" : "signatories"}
          </p>
        </div>

        {loading ? (
          <div className="py-20 text-center text-gray-500">
            <span className="spinner w-6 h-6 border-brand-navy border-t-transparent"></span>
            <p className="mt-3 text-sm">Loading signatories...</p>
          </div>
        ) : signatories.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-gray-500 mb-4">No signatories found.</p>
            <button type="button" onClick={openCreate} className="btn-primary">
              Add your first signatory
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="table-header">Name</th>
                  <th className="table-header">Position</th>
                  <th className="table-header">Signature</th>
                  <th className="table-header">Status</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {signatories.map((signatory) => (
                  <tr key={signatory.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-cell font-medium">{signatory.name}</td>
                    <td className="table-cell text-sm text-gray-500">{signatory.position}</td>
                    <td className="table-cell text-xs text-gray-400">
                      {signatory.signature_storage_key ? "Uploaded" : "None"}
                    </td>
                    <td className="table-cell">
                      <span
                        className={`badge ${signatory.active ? "badge-issued" : "badge-draft"}`}
                      >
                        {signatory.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="table-cell text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          className="btn-secondary px-2.5 py-1 text-xs"
                          onClick={() => openEdit(signatory)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-secondary px-2.5 py-1 text-xs"
                          disabled={busyId === signatory.id}
                          onClick={() => toggleActive(signatory)}
                        >
                          {busyId === signatory.id
                            ? "…"
                            : signatory.active
                              ? "Deactivate"
                              : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 py-10"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            if (!saving) setModalOpen(false);
          }}
        >
          <div className="card w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="card-header flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">
                {editing ? `Edit signatory — ${editing.name}` : "New signatory"}
              </h2>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                disabled={saving}
                onClick={() => setModalOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="card-body space-y-4">
              <div>
                <label className="label" htmlFor="sig-name">
                  Full name
                </label>
                <input
                  id="sig-name"
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rajesh Darbar"
                />
              </div>

              <div>
                <label className="label" htmlFor="sig-position">
                  Position / title
                </label>
                <input
                  id="sig-position"
                  className="input"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="e.g. Director, DarbarTech Group"
                />
              </div>

              {editing?.signature_storage_key && (
                <div>
                  <label className="label">Current signature image</label>
                  <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-md px-3 py-2 break-all">
                    {editing.signature_storage_key}
                  </p>
                </div>
              )}

              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  {formError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={saving}
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={saving}
                  onClick={handleSave}
                >
                  {saving ? "Saving..." : editing ? "Save changes" : "Add signatory"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}