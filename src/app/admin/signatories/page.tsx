"use client";

import { useEffect, useState, useCallback } from "react";
import apiClient from "@/lib/api/client";
import type { SignatoryRecord } from "@/lib/types";
import {
  Badge,
  Button,
  EmptyState,
  Icon,
  Modal,
  PageHeader,
  Spinner,
  StatTile,
} from "@/components/ui";

export default function SignatoriesPage() {
  const [signatories, setSignatories] = useState<SignatoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SignatoryRecord | null>(null);
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [isDefaultSecondary, setIsDefaultSecondary] = useState(false);
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
    setIsDefaultSecondary(false);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (signatory: SignatoryRecord) => {
    setEditing(signatory);
    setName(signatory.name);
    setPosition(signatory.position);
    setIsDefaultSecondary(signatory.is_default_secondary === true);
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
      const payload = { name: cleanName, position: cleanPosition, isDefaultSecondary };
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

  const toggleDefaultSecondary = async (signatory: SignatoryRecord) => {
    setBusyId(signatory.id);
    try {
      await apiClient.updateSignatory(signatory.id, {
        isDefaultSecondary: !signatory.is_default_secondary,
      });
      await load();
    } catch {
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const activeCount = signatories.filter((s) => s.active).length;
  const defaultSecondary = signatories.find((s) => s.is_default_secondary) || null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Configuration"
        title="Signatories"
        description="Manage the authorized signatories shown on issued certificates"
        actions={
          <Button iconLeft="plus" onClick={openCreate}>
            New Signatory
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
        <StatTile icon="users" accent="navy" label="Total" value={signatories.length} />
        <StatTile icon="user" accent="green" label="Active" value={activeCount} />
        <StatTile icon="remove" accent="gray" label="Inactive" value={signatories.length - activeCount} />
        <StatTile
          icon="award"
          accent="cyan"
          label="Default secondary"
          value={defaultSecondary ? defaultSecondary.name : "Not set"}
          hint={defaultSecondary ? defaultSecondary.position : "No signatory marked as default"}
        />
      </div>

      <div className="card overflow-hidden">
        <div className="card-header flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Signatory roster</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {signatories.length} {signatories.length === 1 ? "signatory" : "signatories"}
            </p>
          </div>
        </div>

        {loading ? (
          <Spinner label="Loading signatories..." />
        ) : signatories.length === 0 ? (
          <EmptyState
            icon="users"
            title="No signatories yet"
            message="Add the authorized signatories that will appear on issued certificates."
            actionLabel="Add your first signatory"
            onAction={openCreate}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="table-header">Name</th>
                  <th className="table-header">Position</th>
                  <th className="table-header">Signature</th>
                  <th className="table-header">Default 2°</th>
                  <th className="table-header">Status</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {signatories.map((signatory) => (
                  <tr key={signatory.id} className="hover:bg-surface-muted transition-colors">
                    <td className="table-cell">
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-full bg-brand-navy/8 flex items-center justify-center shrink-0">
                          <span className="text-sm font-bold text-brand-navy">
                            {signatory.name.charAt(0).toUpperCase()}
                          </span>
                        </span>
                        <span className="font-medium">{signatory.name}</span>
                      </div>
                    </td>
                    <td className="table-cell text-sm text-gray-500">{signatory.position}</td>
                    <td className="table-cell text-xs text-gray-400">
                      {signatory.signature_storage_key ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Icon name="check" size={13} className="text-emerald-600" />
                          Uploaded
                        </span>
                      ) : (
                        <span className="text-gray-400">None</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <Badge
                        tone={signatory.is_default_secondary ? "issued" : "gray"}
                        dot={signatory.is_default_secondary}
                      >
                        {signatory.is_default_secondary ? "Default" : "—"}
                      </Badge>
                    </td>
                    <td className="table-cell">
                      <Badge tone={signatory.active ? "green" : "slate"} dot>
                        {signatory.active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="table-cell text-right">
                      <div className="inline-flex items-center gap-2">
                        <Button variant="secondary" size="sm" iconLeft="edit" onClick={() => openEdit(signatory)}>
                          Edit
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={busyId === signatory.id}
                          onClick={() => toggleDefaultSecondary(signatory)}
                          title={
                            signatory.is_default_secondary
                              ? "Unset as default secondary signatory"
                              : "Set as default secondary signatory"
                          }
                        >
                          {busyId === signatory.id ? (
                            <Icon name="refresh" size={13} className="animate-spin" />
                          ) : signatory.is_default_secondary ? (
                            "Unset default"
                          ) : (
                            "Set default"
                          )}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={busyId === signatory.id}
                          onClick={() => toggleActive(signatory)}
                        >
                          {busyId === signatory.id ? (
                            <Icon name="refresh" size={13} className="animate-spin" />
                          ) : signatory.active ? (
                            "Deactivate"
                          ) : (
                            "Activate"
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit signatory — ${editing.name}` : "New signatory"}
        subtitle={editing ? "Update signatory details" : "Add an authorized signatory to the roster"}
        closeDisabled={saving}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editing ? "Save changes" : "Add signatory"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="sig-name">
              Full name
            </label>
            <input
              id="sig-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mohan Shahi"
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

          <div className="flex items-start gap-3 pt-1 rounded-lg border border-gray-200 bg-surface-muted/50 p-3.5">
            <input
              id="sig-default-secondary"
              type="checkbox"
              className="mt-1 accent-brand-navy"
              checked={isDefaultSecondary}
              onChange={(e) => setIsDefaultSecondary(e.target.checked)}
            />
            <div>
              <label htmlFor="sig-default-secondary" className="text-sm font-medium text-gray-900 cursor-pointer">
                Default secondary signatory
              </label>
              <p className="text-xs text-gray-500 mt-0.5">
                When set, this signatory will be pre-filled as the secondary signatory on the
                new-certificate form. Only one signatory can hold this default at a time.
              </p>
            </div>
          </div>

          {editing?.signature_storage_key && (
            <div>
              <label className="label">Current signature image</label>
              <p className="text-xs text-gray-500 bg-surface-muted border border-gray-200 rounded-md px-3 py-2 break-all">
                {editing.signature_storage_key}
              </p>
            </div>
          )}

          {formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{formError}</div>
          )}
        </div>
      </Modal>
    </div>
  );
}