"use client";

import { useEffect, useState, useCallback } from "react";
import apiClient from "@/lib/api/client";
import type { CourseRecord, CourseModuleRecord } from "@/lib/types";
import { DARBARTECH_CERTIFICATE_TEMPLATE_V2 } from "@/lib/templates/darbartech-certificate-v2";

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
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  const openCreate = () => {
    setEditing(null);
    setCode("");
    setTitle("");
    setDuration("");
    setModuleRows(emptyModules(REQUIRED_MODULES.minCount));
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (course: CourseRecord, modules: CourseModuleRecord[]) => {
    setEditing(course);
    setCode(course.code);
    setTitle(course.title);
    setDuration(course.duration);
    setModuleRows(
      modules.length > 0
        ? modules.map((m) => ({ order: m.sort_order, title: m.title, subtitle: m.subtitle || "" }))
        : emptyModules(REQUIRED_MODULES.minCount)
    );
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
    if (modules.length === 0) {
      setFormError("Add at least one course module.");
      return;
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
      // A transient failure leaves the row unchanged; reloading is the fallback.
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const activeCount = courses.filter((c) => c.active).length;
  const validCount = courses.filter(
    (c) => c.active && c.modules.length === REQUIRED_MODULES.maxCount
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Courses</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage catalog courses and their course modules
          </p>
        </div>
        <button type="button" onClick={openCreate} className="btn-primary">
          <span className="mr-2">+</span> New Course
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card card-body">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Total</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{courses.length}</p>
        </div>
        <div className="card card-body">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Active</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{activeCount}</p>
        </div>
        <div className="card card-body">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Inactive</p>
          <p className="text-2xl font-bold text-gray-600 mt-1">{courses.length - activeCount}</p>
        </div>
        <div className="card card-body">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
            Ready to issue ({REQUIRED_MODULES.maxCount} modules)
          </p>
          <p className="text-2xl font-bold text-brand-navy mt-1">{validCount}</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="card-header flex items-center justify-between gap-4">
          <h2 className="font-semibold text-gray-900">Course catalog</h2>
          <p className="text-xs text-gray-400 whitespace-nowrap">
            {courses.length} {courses.length === 1 ? "course" : "courses"}
          </p>
        </div>

        {loading ? (
          <div className="py-20 text-center text-gray-500">
            <span className="spinner w-6 h-6 border-brand-navy border-t-transparent"></span>
            <p className="mt-3 text-sm">Loading courses...</p>
          </div>
        ) : courses.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-gray-500 mb-4">No courses found.</p>
            <button type="button" onClick={openCreate} className="btn-primary">
              Create your first course
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
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
                  return (
                    <tr key={course.id} className="hover:bg-gray-50 transition-colors">
                      <td className="table-cell">
                        <span className="font-mono text-xs font-medium text-brand-navy">
                          {course.code}
                        </span>
                      </td>
                      <td className="table-cell">
                        <span className="text-sm max-w-xs truncate block">{course.title}</span>
                      </td>
                      <td className="table-cell text-sm text-gray-500">{course.duration}</td>
                      <td className="table-cell">
                        <span
                          className={`badge ${moduleOk ? "badge-issued" : "badge-preview"}`}
                          title={
                            moduleOk
                              ? `${course.modules.length} active modules — matches the certificate template`
                              : `${course.modules.length} active modules — certificate template requires ${REQUIRED_MODULES.maxCount}`
                          }
                        >
                          {course.modules.length}/{REQUIRED_MODULES.maxCount}
                        </span>
                      </td>
                      <td className="table-cell">
                        <span className={`badge ${course.active ? "badge-issued" : "badge-draft"}`}>
                          {course.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="table-cell text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            className="btn-secondary px-2.5 py-1 text-xs"
                            onClick={() => openEdit(course, course.modules)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn-secondary px-2.5 py-1 text-xs"
                            disabled={busyId === course.id}
                            onClick={() => toggleActive(course)}
                          >
                            {busyId === course.id
                              ? "…"
                              : course.active
                                ? "Deactivate"
                                : "Activate"}
                          </button>
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

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 py-10"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            if (!saving) setModalOpen(false);
          }}
        >
          <div className="card w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="card-header flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">
                {editing ? `Edit course — ${editing.code}` : "New course"}
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
                  <button
                    type="button"
                    className="btn-secondary px-2.5 py-1 text-xs"
                    onClick={() =>
                      setModuleRows((rows) => [
                        ...rows,
                        { order: rows.length + 1, title: "", subtitle: "" },
                      ])
                    }
                  >
                    + Add row
                  </button>
                </div>

                {moduleRows.length !== REQUIRED_MODULES.maxCount && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-2">
                    This course has {moduleRows.length} module row
                    {moduleRows.length === 1 ? "" : "s"} (active rows saved) — certificates for it
                    will still be flagged on the dashboard until it matches the template
                    requirement of {REQUIRED_MODULES.maxCount}.
                  </p>
                )}

                <div className="space-y-2">
                  {moduleRows.map((row, i) => (
                    <div
                      key={`${i}-${row.order}`}
                      className="grid grid-cols-1 sm:grid-cols-[80px_1fr_1fr_auto] gap-2 items-start"
                    >
                      <div>
                        <p className="sr-only">Order {i + 1}</p>
                        <div className="h-[38px] flex items-center px-2 text-xs font-medium text-gray-500">
                          {String(i + 1).padStart(2, "0")}
                        </div>
                      </div>
                      <input
                        className="input"
                        value={row.title}
                        onChange={(e) => setRow(i, { title: e.target.value })}
                        placeholder="Module title"
                      />
                      <input
                        className="input"
                        value={row.subtitle}
                        onChange={(e) => setRow(i, { subtitle: e.target.value })}
                        placeholder="Subtitle (optional)"
                      />
                      <button
                        type="button"
                        className="btn-secondary px-2.5 py-1 text-xs whitespace-nowrap"
                        disabled={moduleRows.length <= 1}
                        onClick={() =>
                          setModuleRows((rows) => rows.filter((_, idx) => idx !== i))
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>

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
                <button type="button" className="btn-primary" disabled={saving} onClick={handleSave}>
                  {saving ? "Saving..." : editing ? "Save changes" : "Create course"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}