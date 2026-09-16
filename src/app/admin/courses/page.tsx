"use client";

import { useEffect, useState, useCallback } from "react";
import apiClient from "@/lib/api/client";
import type { CourseRecord, CourseModuleRecord, CertificateModule } from "@/lib/types";
import { DARBARTECH_CERTIFICATE_TEMPLATE_V2 } from "@/lib/templates/darbartech-certificate-v2";
import { collectModuleFitIssues, type ModuleFitIssue } from "@/lib/renderer/moduleFit";
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Icon,
  Modal,
  PageHeader,
  Spinner,
  StatTile,
} from "@/components/ui";

type CourseWithModules = CourseRecord & { modules: CourseModuleRecord[] };

type ModuleDraft = { order: number; title: string; subtitle: string };

const REQUIRED_MODULES = DARBARTECH_CERTIFICATE_TEMPLATE_V2.moduleConstraints;

const emptyModules = (count: number): ModuleDraft[] =>
  Array.from({ length: count }, (_, i) => ({ order: i + 1, title: "", subtitle: "" }));

export default function CoursesPage() {
  const [courses, setCourses] = useState<CourseWithModules[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CourseRecord | null>(null);
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("");
  const [moduleRows, setModuleRows] = useState<ModuleDraft[]>(emptyModules(REQUIRED_MODULES.minCount));
  const [moduleFitIssues, setModuleFitIssues] = useState<ModuleFitIssue[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const runModuleFitCheck = useCallback((rows: ModuleDraft[]) => {
    const modules: CertificateModule[] = rows
      .filter((row) => row.title.trim().length > 0)
      .map((row, i) => ({
        order: i + 1,
        title: row.title.trim(),
        subtitle: row.subtitle.trim() || undefined,
      }));
    const issues = collectModuleFitIssues(DARBARTECH_CERTIFICATE_TEMPLATE_V2, modules);
    setModuleFitIssues(issues);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiClient.listCourses();
      if (result.success && result.data) {
        setCourses(result.data as CourseWithModules[]);
      }
    } catch {
      // Falls through as an empty list; the UI surfaces the empty state.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (modalOpen) {
      runModuleFitCheck(moduleRows);
    }
  }, [moduleRows, modalOpen, runModuleFitCheck]);

  const openCreate = () => {
    setEditing(null);
    setCode("");
    setTitle("");
    setDuration("");
    const initialRows = emptyModules(REQUIRED_MODULES.minCount);
    setModuleRows(initialRows);
    setModuleFitIssues([]);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (course: CourseRecord, modules: CourseModuleRecord[]) => {
    setEditing(course);
    setCode(course.code);
    setTitle(course.title);
    setDuration(course.duration);
    const initialRows =
      modules.length > 0
        ? modules.map((m) => ({ order: m.sort_order, title: m.title, subtitle: m.subtitle || "" }))
        : emptyModules(REQUIRED_MODULES.minCount);
    setModuleRows(initialRows);
    setModuleFitIssues([]);
    setFormError(null);
    setModalOpen(true);
  };

  const openDuplicate = (course: CourseRecord, modules: CourseModuleRecord[]) => {
    setEditing(null);
    setCode("");
    setTitle(`${course.title} (copy)`);
    setDuration(course.duration);
    const initialRows =
      modules.length > 0
        ? modules.map((m) => ({ order: m.sort_order, title: m.title, subtitle: m.subtitle || "" }))
        : emptyModules(REQUIRED_MODULES.minCount);
    setModuleRows(initialRows);
    setModuleFitIssues([]);
    setFormError(null);
    setModalOpen(true);
  };

  const setRow = (index: number, patch: Partial<ModuleDraft>) => {
    setModuleRows((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const handleSave = async () => {
    setFormError(null);
    const cleanCode = code.trim();
    const cleanTitle = title.trim();
    const cleanDuration = duration.trim();
    if (!cleanCode || !cleanTitle || !cleanDuration) {
      setFormError("Code, title, and duration are required.");
      return;
    }

    const modules = moduleRows
      .filter((row) => row.title.trim().length > 0)
      .map((row, i) => ({ order: i + 1, title: row.title.trim(), subtitle: row.subtitle.trim() || undefined }));

    const { minCount, maxCount } = REQUIRED_MODULES;
    if (minCount === maxCount) {
      if (modules.length !== minCount) {
        setFormError(
          `This template requires exactly ${minCount} active modules — you have ${modules.length}`
        );
        return;
      }
    } else {
      if (modules.length < minCount || modules.length > maxCount) {
        setFormError(
          `This template requires between ${minCount} and ${maxCount} active modules — you have ${modules.length}`
        );
        return;
      }
    }

    setSaving(true);
    try {
      const payload = { code: cleanCode, title: cleanTitle, duration: cleanDuration, modules };
      const result = editing
        ? await apiClient.updateCourse(editing.id, payload)
        : await apiClient.createCourse(payload);
      if (!result.success) {
        setFormError(
          (result.errors && result.errors.join(" ")) || result.error || "Failed to save course."
        );
        return;
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save course.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (course: CourseWithModules) => {
    setBusyId(course.id);
    try {
      await apiClient.updateCourse(course.id, { active: !course.active });
      await load();
    } catch {
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === courses.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(courses.map((c) => c.id)));
    }
  };

  const bulkActivate = async () => {
    setBulkBusy(true);
    try {
      const ids = Array.from(selectedIds);
      for (const id of ids) {
        await apiClient.updateCourse(id, { active: true });
      }
      setSelectedIds(new Set());
      await load();
    } catch {
      await load();
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkDeactivate = async () => {
    setBulkBusy(true);
    try {
      const ids = Array.from(selectedIds);
      for (const id of ids) {
        await apiClient.updateCourse(id, { active: false });
      }
      setSelectedIds(new Set());
      await load();
    } catch {
      await load();
    } finally {
      setBulkBusy(false);
    }
  };

  const activeCount = courses.filter((c) => c.active).length;
  const validCount = courses.filter(
    (c) => c.active && c.modules.length === REQUIRED_MODULES.maxCount
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catalog"
        title="Courses"
        description="Manage catalog courses and their course modules"
        actions={
          <Button iconLeft="plus" onClick={openCreate}>
            New Course
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
        <StatTile icon="courses" accent="navy" label="Total" value={courses.length} />
        <StatTile icon="check" accent="green" label="Active" value={activeCount} />
        <StatTile icon="remove" accent="gray" label="Inactive" value={courses.length - activeCount} />
        <StatTile
          icon="award"
          accent="cyan"
          label={`Ready to issue (${REQUIRED_MODULES.maxCount} modules)`}
          value={validCount}
        />
      </div>

      <div className="card overflow-hidden">
        <div className="card-header flex items-center justify-between gap-4">
          {selectedIds.size > 0 ? (
            <div className="flex items-center justify-between w-full gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">
                  {selectedIds.size} selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" disabled={bulkBusy} onClick={bulkActivate}>
                  {bulkBusy ? <Icon name="refresh" size={13} className="animate-spin" /> : null}
                  Activate selected
                </Button>
                <Button variant="secondary" size="sm" disabled={bulkBusy} onClick={bulkDeactivate}>
                  {bulkBusy ? <Icon name="refresh" size={13} className="animate-spin" /> : null}
                  Deactivate selected
                </Button>
                <Button variant="ghost" size="sm" disabled={bulkBusy} onClick={() => setSelectedIds(new Set())}>
                  Clear
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Course catalog</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {courses.length} {courses.length === 1 ? "course" : "courses"}
              </p>
            </div>
          )}
        </div>

        {loading ? (
          <Spinner label="Loading courses..." />
        ) : courses.length === 0 ? (
          <EmptyState
            icon="courses"
            title="No courses yet"
            message="Add catalog courses so certificates can be issued against them."
            actionLabel="Create your first course"
            onAction={openCreate}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="table-header w-10">
                    <input
                      type="checkbox"
                      className="cursor-pointer accent-brand-navy"
                      checked={selectedIds.size === courses.length && courses.length > 0}
                      onChange={toggleSelectAll}
                      aria-label="Select all courses"
                    />
                  </th>
                  <th className="table-header">Code</th>
                  <th className="table-header">Title</th>
                  <th className="table-header">Duration</th>
                  <th className="table-header">Modules</th>
                  <th className="table-header">Status</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {courses.map((course) => {
                  const moduleOk = course.modules.length === REQUIRED_MODULES.maxCount;
                  const isSelected = selectedIds.has(course.id);
                  return (
                    <tr key={course.id} className={`transition-colors ${isSelected ? "bg-brand-navy/5" : "hover:bg-surface-muted"}`}>
                      <td className="table-cell w-10">
                        <input
                          type="checkbox"
                          className="cursor-pointer accent-brand-navy"
                          checked={isSelected}
                          onChange={() => toggleSelected(course.id)}
                          aria-label={`Select course ${course.code}`}
                        />
                      </td>
                      <td className="table-cell">
                        <span className="font-mono text-xs font-semibold text-brand-navy">
                          {course.code}
                        </span>
                      </td>
                      <td className="table-cell">
                        <span className="text-sm max-w-xs truncate block">{course.title}</span>
                      </td>
                      <td className="table-cell text-sm text-gray-500">{course.duration}</td>
                      <td className="table-cell">
                        <Badge tone={moduleOk ? "issued" : "cyan"}>
                          {course.modules.length}/{REQUIRED_MODULES.maxCount}
                        </Badge>
                      </td>
                      <td className="table-cell">
                        <Badge tone={course.active ? "green" : "slate"} dot>
                          {course.active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="table-cell text-right">
                        <div className="inline-flex items-center gap-2">
                          <Button variant="secondary" size="sm" onClick={() => openDuplicate(course, course.modules)}>
                            Duplicate
                          </Button>
                          <Button variant="secondary" size="sm" iconLeft="edit" onClick={() => openEdit(course, course.modules)}>
                            Edit
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={busyId === course.id}
                            onClick={() => toggleActive(course)}
                          >
                            {busyId === course.id ? (
                              <Icon name="refresh" size={13} className="animate-spin" />
                            ) : course.active ? (
                              "Deactivate"
                            ) : (
                              "Activate"
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit course — ${editing.code}` : "New course"}
        subtitle="Program title, duration and the modules displayed on the certificate"
        maxWidth="max-w-2xl"
        closeDisabled={saving}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editing ? "Save changes" : "Create course"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="course-code">
                Course code
              </label>
              <input
                id="course-code"
                className="input"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. PCDSP-002"
              />
            </div>
            <div>
              <label className="label" htmlFor="course-duration">
                Duration
              </label>
              <input
                id="course-duration"
                className="input"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g. 3 Months"
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="course-title">
              Title
            </label>
            <input
              id="course-title"
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Professional Computer & Digital Skills Program"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">
                Course modules{" "}
                <span className="font-normal text-gray-400">
                  (displayed on the certificate; template requires{" "}
                  {REQUIRED_MODULES.minCount === REQUIRED_MODULES.maxCount
                    ? `exactly ${REQUIRED_MODULES.maxCount}`
                    : `${REQUIRED_MODULES.minCount}–${REQUIRED_MODULES.maxCount}`}
                  )
                </span>
              </label>
              <Button
                variant="secondary"
                size="sm"
                iconLeft="plus"
                onClick={() =>
                  setModuleRows((rows) => [
                    ...rows,
                    { order: rows.length + 1, title: "", subtitle: "" },
                  ])
                }
              >
                Add row
              </Button>
            </div>

            <div className="space-y-3">
              {moduleRows.map((row, i) => {
                const order = i + 1;
                const titleIssues = moduleFitIssues.filter(
                  (fi) => fi.order === order && fi.field.includes("Title")
                );
                const subtitleIssues = moduleFitIssues.filter(
                  (fi) => fi.order === order && fi.field.includes("Subtitle")
                );
                return (
                  <div key={`${i}-${row.order}`} className="rounded-lg border border-gray-200 bg-surface-muted/40 p-3 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-[56px_1fr_1fr_auto] gap-2 items-start">
                      <div>
                        <p className="sr-only">Order {order}</p>
                        <div className="h-[38px] flex items-center text-xs font-bold text-brand-navy tabular-nums">
                          {String(order).padStart(2, "0")}
                        </div>
                      </div>
                      <div>
                        <input
                          className="input"
                          value={row.title}
                          onChange={(e) => setRow(i, { title: e.target.value })}
                          placeholder="Module title"
                        />
                        {titleIssues.map((fi, idx) => (
                          <p key={`t-${idx}`} className={`mt-1 text-xs ${fi.hard ? "text-red-600" : "text-amber-700"}`}>
                            {fi.reason}
                          </p>
                        ))}
                      </div>
                      <div>
                        <input
                          className="input"
                          value={row.subtitle}
                          onChange={(e) => setRow(i, { subtitle: e.target.value })}
                          placeholder="Subtitle (optional)"
                        />
                        {subtitleIssues.map((fi, idx) => (
                          <p key={`s-${idx}`} className={`mt-1 text-xs ${fi.hard ? "text-red-600" : "text-amber-700"}`}>
                            {fi.reason}
                          </p>
                        ))}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        iconLeft="remove"
                        disabled={moduleRows.length <= 1}
                        onClick={() => setModuleRows((rows) => rows.filter((_, idx) => idx !== i))}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {formError && (
            <Alert variant="error" title={formError} />
          )}
        </div>
      </Modal>
    </div>
  );
}