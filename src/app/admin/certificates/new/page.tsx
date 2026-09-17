"use client";

import { useState, useEffect, FormEvent, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import apiClient from "@/lib/api/client";
import { PageHeader, Stepper, Icon } from "@/components/ui";
import { getCurrentDateStr } from "@/lib/renderer/dateFormatter";
import { collectModuleFitIssues, type ModuleFitIssue } from "@/lib/renderer/moduleFit";
import { getTemplateById, DARBARTECH_CERTIFICATE_TEMPLATE_V2 } from "@/lib/templates/darbartech-certificate-v2";
import type {
  CertificateCreateInput,
  CertificateModule,
  AdminUser,
  SignatoryRecord,
  CourseRecord,
  CourseModuleRecord,
  CertificateRecord,
} from "@/lib/types";

const EXACT_MODULE_COUNT = DARBARTECH_CERTIFICATE_TEMPLATE_V2.moduleConstraints.maxCount;

const WIZARD_STEPS = [
  { key: "recipient", label: "Recipient" },
  { key: "course", label: "Course" },
  { key: "modules", label: "Modules" },
  { key: "results", label: "Results & Dates" },
  { key: "signatories", label: "Signatories" },
  { key: "preview", label: "Preview & Issue" },
];

const FUZZY_MATCH_MIN_LENGTH = 3;

const normalizeForMatch = (s: string): string =>
  s.trim().toLowerCase().replace(/\s+/g, " ");

// Case-insensitive substring/similarity check used by the manual-entry
// "looks like an existing course" notice. Returns the best scoring catalog
// match (score = length of the shared normalized segment), or null.
const findSimilarCourse = (
  inputTitle: string,
  courses: (CourseRecord & { modules: CourseModuleRecord[] })[]
): { code: string; title: string } | null => {
  const input = normalizeForMatch(inputTitle);
  if (input.length < FUZZY_MATCH_MIN_LENGTH) return null;
  let best: { code: string; title: string; score: number } | null = null;
  for (const course of courses) {
    const candidates = [course.certificateTitle, course.title].filter(
      (c): c is string => typeof c === "string" && c.trim().length > 0
    );
    for (const candidate of candidates) {
      const norm = normalizeForMatch(candidate);
      if (!norm) continue;
      let score = 0;
      if (norm.includes(input)) score = input.length;
      else if (input.includes(norm)) score = norm.length;
      if (score > 0 && (!best || score > best.score)) {
        best = { code: course.code, title: candidate, score };
      }
    }
  }
  return best;
};

type CreateStage = "form" | "preview" | "success";

// Converts a "data:<mime>;base64,<data>" string into a Blob object URL.
// Blob URLs don't have the ~2MB character limit that data URIs hit when
// used as an <iframe src> in Chrome, which causes large PDFs to silently
// fail to render.
function base64DataUriToBlobUrl(dataUri: string): string {
  const [header, base64] = dataUri.split(",");
  const mimeMatch = header.match(/data:(.*);base64/);
  const mimeType = mimeMatch?.[1] || "application/pdf";

  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });
  return URL.createObjectURL(blob);
}

export default function CreateCertificatePage() {
  const [stage, setStage] = useState<CreateStage>("form");
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [loadingSignatories, setLoadingSignatories] = useState(true);
  const [courses, setCourses] = useState<(CourseRecord & { modules: CourseModuleRecord[] })[]>([]);
  const [signatories, setSignatories] = useState<SignatoryRecord[]>([]);
  const [previewPdf, setPreviewPdf] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewErrors, setPreviewErrors] = useState<string[]>([]);
  const [moduleFitIssues, setModuleFitIssues] = useState<ModuleFitIssue[]>([]);
  const [issueLoading, setIssueLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [issuedCert, setIssuedCert] = useState<CertificateRecord | null>(null);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [fuzzyDupDismissed, setFuzzyDupDismissed] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);

  const [formData, setFormData] = useState<CertificateCreateInput & {
    certificateTemplateId?: string;
    certificateTemplateVersion?: string;
    providerName?: string;
    completionStatement?: string;
  }>({
    recipient: { name: "" },
    program: { title: "", duration: "", id: "", code: "" },
    modules: [],
    grade: "",
    completionDate: "",
    issueDate: getCurrentDateStr(),
    signatory: { name: "", position: "", id: "" },
    secondarySignatory: { name: "", position: "", id: "" },
    certificateTemplateId: "",
    certificateTemplateVersion: "",
    providerName: "",
    completionStatement: "",
  });

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const loadCourses = useCallback(async () => {
    setLoadingCourses(true);
    setCoursesError(null);
    try {
      const res = await apiClient.listCourses();
      if (res.success && res.data) {
        setCourses(res.data);
      } else {
        setCoursesError(res.errors?.join(", ") || "Failed to load courses");
        setCourses([]);
      }
    } catch (err) {
      setCoursesError(err instanceof Error ? err.message : "Failed to load courses");
      setCourses([]);
    } finally {
      setLoadingCourses(false);
    }
  }, []);

  const loadSignatories = async () => {
    setLoadingSignatories(true);
    try {
      const res = await apiClient.listSignatories();
      if (res.success && res.data) setSignatories(res.data);
    } finally {
      setLoadingSignatories(false);
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem("dt_admin");
    if (stored) setUser(JSON.parse(stored));
    loadCourses();
    loadSignatories();
  }, [loadCourses]);

  useEffect(() => {
    if (loadingSignatories || signatories.length === 0) return;
    const defaultSecondary = signatories.find((s) => s.is_default_secondary);
    if (defaultSecondary) {
      setFormData((prev) => {
        if (prev.secondarySignatory?.name || prev.secondarySignatory?.position) {
          return prev;
        }
        return {
          ...prev,
          secondarySignatory: {
            id: defaultSecondary.id,
            name: defaultSecondary.name,
            position: defaultSecondary.position,
          },
        };
      });
    }
  }, [signatories, loadingSignatories]);

  useEffect(() => {
    return () => {
      if (previewPdf && previewPdf.startsWith("blob:")) {
        URL.revokeObjectURL(previewPdf);
      }
    };
  }, [previewPdf]);

  const handleCourseSelect = useCallback((courseId: string) => {
    setSelectedCourseId(courseId);
    setFuzzyDupDismissed(false);

    if (!courseId) {
      setFormData((prev) => ({
        recipient: prev.recipient,
        grade: prev.grade,
        completionDate: prev.completionDate,
        issueDate: prev.issueDate,
        signatory: prev.signatory,
        secondarySignatory: prev.secondarySignatory,
        manualCertificateNumber: prev.manualCertificateNumber,
        program: { id: "", title: "", duration: "", code: "" },
        modules: [],
        certificateTemplateId: "",
        certificateTemplateVersion: "",
        providerName: "",
        completionStatement: "",
      }));
      return;
    }

    const course = courses.find((c) => c.id === courseId);
    if (!course) return;

    const titleFromCourse = course.certificateTitle || course.title;
    const activeModules = course.modules
      .filter((m: CourseModuleRecord) => m.active !== false)
      .sort((a: CourseModuleRecord, b: CourseModuleRecord) => a.sort_order - b.sort_order);

    setFormData((prev) => ({
      recipient: prev.recipient,
      grade: prev.grade,
      completionDate: prev.completionDate,
      issueDate: prev.issueDate,
      signatory: prev.signatory,
      secondarySignatory: prev.secondarySignatory,
      manualCertificateNumber: prev.manualCertificateNumber,
      program: {
        id: course.id,
        title: titleFromCourse,
        duration: course.duration,
        code: course.code,
      },
      modules: activeModules.map((m: CourseModuleRecord): CertificateModule => ({
        order: m.sort_order,
        title: m.title,
        subtitle: m.subtitle || "",
      })),
      certificateTemplateId: course.certificateTemplateId || "",
      certificateTemplateVersion: course.certificateTemplateVersion || "",
      providerName: course.providerName || "",
      completionStatement: course.completionStatement || "",
    }));
  }, [courses]);

  const selectedCourse = selectedCourseId
    ? courses.find((c) => c.id === selectedCourseId) || null
    : null;

  const fuzzyCourseMatch = useMemo(() => {
    if (fuzzyDupDismissed || selectedCourseId) return null;
    return findSimilarCourse(formData.program.title || "", courses);
  }, [fuzzyDupDismissed, selectedCourseId, courses, formData.program.title]);

  const isTemplateCompatible = formData.modules.length === EXACT_MODULE_COUNT;
  const templateIssues: string[] = [];
  if (selectedCourse && !isTemplateCompatible) {
    templateIssues.push(
      `Course &quot;${selectedCourse.code}&quot; defines ${formData.modules.length} active modules, but certificate template v2 requires exactly ${EXACT_MODULE_COUNT}.`
    );
  }
  if (!selectedCourse && !isTemplateCompatible) {
    templateIssues.push(
      `Certificate template v2 requires exactly ${EXACT_MODULE_COUNT} modules. Current count: ${formData.modules.length}.`
    );
  }

  const stepCompleted = (index: number): boolean => {
    switch (index) {
      case 0:
        return !!formData.recipient.name.trim();
      case 1:
        return !!selectedCourse || !!formData.program.title.trim();
      case 2:
        return (
          !!formData.program.title.trim() &&
          !!formData.program.duration.trim() &&
          formData.modules.length === EXACT_MODULE_COUNT &&
          formData.modules.every((m: CertificateModule) => m.title.trim().length > 0)
        );
      case 3:
        return !!formData.issueDate;
      case 4:
        return (
          !!formData.signatory.name.trim() &&
          !!formData.signatory.position.trim() &&
          !!formData.secondarySignatory?.name?.trim() &&
          !!formData.secondarySignatory?.position?.trim()
        );
      default:
        return false;
    }
  };

  const allPreviousComplete = (index: number): boolean => {
    for (let i = 0; i < index; i++) {
      if (!stepCompleted(i)) return false;
    }
    return true;
  };

  const activeStep = stage === "preview" ? 5 : wizardStep;

  const canReachStep = (index: number): boolean => {
    if (stage === "preview") return index <= 4;
    if (index <= wizardStep) return true;
    return allPreviousComplete(index);
  };

  const handleStepSelect = (index: number) => {
    if (index === 5) {
      formRef.current?.requestSubmit();
      return;
    }
    if (stage === "preview") {
      setStage("form");
      setWizardStep(index);
      return;
    }
    if (index < wizardStep) setWizardStep(index);
    else if (index > wizardStep && allPreviousComplete(index)) setWizardStep(index);
  };

  const handleSignatorySelect = (signatoryId: string) => {
    const sig = signatories.find((s) => s.id === signatoryId);
    if (!sig) return;
    setFormData((prev: CertificateCreateInput) => ({
      ...prev,
      signatory: {
        id: sig.id,
        name: sig.name,
        position: sig.position,
      },
    }));
  };

  const handleSecondarySignatorySelect = (signatoryId: string) => {
    const sig = signatories.find((s) => s.id === signatoryId);
    if (!sig) return;
    setFormData((prev: CertificateCreateInput) => ({
      ...prev,
      secondarySignatory: {
        id: sig.id,
        name: sig.name,
        position: sig.position,
      },
    }));
  };

  const addModule = () => {
    const nextOrder =
      formData.modules.length > 0
        ? Math.max(...formData.modules.map((m: CertificateModule) => m.order)) + 1
        : 1;
    setFormData((prev: CertificateCreateInput) => ({
      ...prev,
      modules: [...prev.modules, { order: nextOrder, title: "", subtitle: "" }],
    }));
  };

  const removeModule = (idx: number) => {
    setFormData((prev: CertificateCreateInput) => {
      const remaining = prev.modules.filter((_: CertificateModule, i: number) => i !== idx);
      return {
        ...prev,
        modules: remaining.map((m: CertificateModule, i: number) => ({ ...m, order: i + 1 })),
      };
    });
  };

  const updateModule = (idx: number, field: "title" | "subtitle", value: string) => {
    setFormData((prev: CertificateCreateInput) => {
      const updated = [...prev.modules];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, modules: updated };
    });
  };

  const moveModule = (idx: number, direction: -1 | 1) => {
    setFormData((prev: CertificateCreateInput) => {
      const modules = [...prev.modules];
      const target = idx + direction;
      if (target < 0 || target >= modules.length) return prev;
      [modules[idx], modules[target]] = [modules[target], modules[idx]];
      return {
        ...prev,
        modules: modules.map((m: CertificateModule, i: number) => ({ ...m, order: i + 1 })),
      };
    });
  };

  const generatePreview = async () => {
    setPreviewLoading(true);
    setPreviewErrors([]);
    setFormErrors([]);
    try {
      const resolvedTpl = getTemplateById(
        formData.certificateTemplateId ?? formData.certificateTemplateVersion ?? "",
        formData.certificateTemplateVersion
      );
      const fitIssues = collectModuleFitIssues(resolvedTpl, formData.modules);
      if (fitIssues.length > 0) {
        setModuleFitIssues(fitIssues);
        setPreviewErrors(fitIssues.map((fi) => fi.reason));
        setPreviewLoading(false);
        return;
      }
      setModuleFitIssues([]);
      const result = await apiClient.generatePreview(formData);
      if (result.success && result.preview) {
        // The API returns a base64 data URI. For anything but tiny PDFs this
        // can exceed Chrome's ~2,097,152-character URL length limit when used
        // directly as an <iframe src>, causing it to silently fail to render
        // (no console error, just a blank frame). Converting to a Blob URL
        // avoids that limit entirely.
        const blobUrl = base64DataUriToBlobUrl(result.preview);
        setPreviewPdf((prev) => {
          if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
          return blobUrl;
        });
        setPreviewErrors(result.warnings || []);
      } else {
        setPreviewErrors(result.errors || ["Preview generation failed"]);
      }
    } catch (err) {
      setPreviewErrors([err instanceof Error ? err.message : "Preview error"]);
    } finally {
      setPreviewLoading(false);
    }
  };

  const validateForm = (): string[] => {
    const errs: string[] = [];
    if (!formData.recipient.name.trim()) errs.push("Recipient name is required");
    if (!formData.program.title.trim()) errs.push("Program title is required");
    if (!formData.program.duration.trim()) errs.push("Program duration is required");
    if (formData.modules.length !== EXACT_MODULE_COUNT) {
      errs.push(
        `Exactly ${EXACT_MODULE_COUNT} modules are required for the certificate template v2. Current count: ${formData.modules.length}.`
      );
    }
    formData.modules.forEach((m: CertificateModule, i: number) => {
      if (!m.title.trim()) errs.push(`Module ${i + 1}: title is required`);
    });
    if (!formData.issueDate) errs.push("Issue date is required");
    if (!formData.signatory.name.trim()) errs.push("Signatory name is required");
    if (!formData.signatory.position.trim()) errs.push("Signatory position is required");
    if (!formData.secondarySignatory?.name?.trim()) errs.push("Secondary Signatory name is required");
    if (!formData.secondarySignatory?.position?.trim()) errs.push("Secondary Signatory position is required");
    return errs;
  };

  const goToPreview = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validateForm();
    if (errs.length > 0) {
      setFormErrors(errs);
      return;
    }
    setFormErrors([]);
    const draftResult = await apiClient.createDraftCertificate(formData);
    if (draftResult.success && draftResult.certificate) {
      setDraftId(draftResult.certificate.id);
    }
    setStage("preview");
    await generatePreview();
  };

  const handleIssue = async () => {
    if (!draftId) {
      const draftResult = await apiClient.createDraftCertificate(formData);
      if (!draftResult.success || !draftResult.certificate) {
        setPreviewErrors(draftResult.errors || ["Could not create draft"]);
        return;
      }
      setDraftId(draftResult.certificate.id);
    }

    setIssueLoading(true);
    setPreviewErrors([]);
    try {
      const result = await apiClient.issueCertificate(draftId!, formData);
      if (result.success && result.certificate) {
        setIssuedCert(result.certificate as CertificateRecord);
        setVerificationUrl(result.verificationUrl || null);
        setStage("success");
      } else {
        setPreviewErrors(result.errors || ["Issuance failed"]);
      }
    } catch (err) {
      setPreviewErrors([err instanceof Error ? err.message : "Issuance error"]);
    } finally {
      setIssueLoading(false);
    }
  };

  const canIssue = user?.permissions.ISSUE_CERTIFICATE || user?.role === "super_admin";

  if (stage === "success" && issuedCert) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card card-body text-center py-12">
          <div className="w-20 h-20 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Certificate Issued!</h1>
          <p className="text-gray-500 mb-8">
            The certificate has been successfully issued and is available for verification.
          </p>
          <div className="bg-gray-50 rounded-lg p-6 mb-8 text-left max-w-md mx-auto">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Certificate No.</span>
                <span className="font-mono font-semibold text-brand-navy">{issuedCert.certificate_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Recipient</span>
                <span className="font-medium">{issuedCert.recipient_name}</span>
              </div>
              {issuedCert.student_id && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Student ID</span>
                  <span className="font-mono font-medium">{issuedCert.student_id}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Program</span>
                <span className="font-medium">{issuedCert.program_title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className="badge badge-issued">ISSUED</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/admin/certificates" className="btn-primary px-6 w-full sm:w-auto">
              Back to Certificates
            </Link>
            <button
              onClick={() => apiClient.downloadCertificate(issuedCert.id)}
              className="btn-secondary px-6 w-full sm:w-auto"
            >
              Download PDF
            </button>
            <a
              href={
                verificationUrl ||
                `/verify?number=${encodeURIComponent(issuedCert.certificate_number)}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="btn-gold px-6 w-full sm:w-auto"
            >
              View Verification
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (stage === "preview") {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Certificates"
          title="Preview & Issue"
          description="Review the certificate before final issuance"
          actions={
            <button
              onClick={() => {
                setStage("form");
                setWizardStep(4);
              }}
              className="btn-secondary"
            >
              Edit Form
            </button>
          }
        />
        <div className="card card-body py-4 overflow-hidden">
          <Stepper
            steps={WIZARD_STEPS}
            current={activeStep}
            completed={stepCompleted}
            onSelect={handleStepSelect}
            disabled={canReachStep}
          />
        </div>

        {previewErrors.length > 0 && (
          <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4">
            <p className="text-sm font-medium text-yellow-800 mb-2">Layout warnings:</p>
            <ul className="list-disc list-inside space-y-0.5 text-sm text-yellow-700">
              {previewErrors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card overflow-hidden">
            <div className="card-header flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Certificate Preview</h2>
              <button onClick={generatePreview} className="btn-secondary text-sm py-1.5" disabled={previewLoading}>
                {previewLoading ? (
                  <span className="inline-flex items-center gap-2"><span className="spinner"></span>Regenerating...</span>
                ) : (
                  "Regenerate Preview"
                )}
              </button>
            </div>
            <div className="p-4 bg-gray-100">
              {previewLoading && !previewPdf ? (
                <div className="h-[600px] flex items-center justify-center text-gray-500">
                  <span className="spinner w-8 h-8 border-brand-navy border-t-transparent"></span>
                  <span className="ml-3">Generating preview...</span>
                </div>
              ) : previewPdf ? (
                <iframe
                  ref={iframeRef}
                  src={previewPdf}
                  className="w-full h-[800px] rounded-lg border border-gray-200 bg-white shadow-sm"
                  title="Certificate PDF preview"
                />
              ) : (
                <div className="h-[600px] flex items-center justify-center text-gray-500">
                  Preview not available. Click Regenerate.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="card card-body space-y-4">
              <h3 className="font-semibold text-gray-900">Summary</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Recipient</dt>
                  <dd className="font-medium text-right">{formData.recipient.name}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Program</dt>
                  <dd className="font-medium text-right max-w-[60%]">{formData.program.title}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Duration</dt>
                  <dd className="font-medium text-right">{formData.program.duration}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Modules</dt>
                  <dd className="font-medium text-right">{formData.modules.length}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Grade</dt>
                  <dd className="font-medium text-right">{formData.grade || "—"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Issue Date</dt>
                  <dd className="font-medium text-right">{formData.issueDate}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Signatory</dt>
                  <dd className="font-medium text-right max-w-[60%]">{formData.signatory.name}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Secondary Signatory</dt>
                  <dd className="font-medium text-right max-w-[60%]">{formData.secondarySignatory?.name || "—"}</dd>
                </div>
              </dl>
            </div>

            <div className="card card-body space-y-4">
              <h3 className="font-semibold text-gray-900">Issue Certificate</h3>
              <p className="text-xs text-gray-500">
                Issuing is final. Issued certificates become publicly verifiable and cannot be edited silently.
              </p>
              {!canIssue && (
                <p className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
                  Your account does not have permission to issue certificates.
                </p>
              )}
              {templateIssues.length > 0 && (
                <div
                  className={
                    selectedCourse
                      ? "rounded-lg border border-amber-300 bg-amber-50 p-3"
                      : "rounded-lg border border-amber-300 bg-amber-50 p-3"
                  }
                >
                  <p className="text-xs font-semibold text-amber-800 mb-1">Template compatibility warning</p>
                  <ul className="space-y-0.5 text-xs text-amber-700 list-disc list-inside">
                    {templateIssues.map((ti, i) => (
                      <li key={i}>{ti}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleIssue}
                  disabled={!canIssue || issueLoading || previewLoading || !isTemplateCompatible}
                  className="btn-success w-full"
                >
                  {issueLoading ? (
                    <span className="inline-flex items-center gap-2"><span className="spinner"></span>Issuing...</span>
                  ) : !isTemplateCompatible ? (
                    `Module count must be exactly ${EXACT_MODULE_COUNT}`
                  ) : (
                    "Approve & Issue Certificate"
                  )}
                </button>
                <button onClick={generatePreview} className="btn-secondary w-full" disabled={previewLoading}>
                  Regenerate Preview
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={goToPreview} className="space-y-6">
      <PageHeader
        eyebrow="Certificates"
        title="Create Certificate"
        description="Enter recipient, program, results, and signatory details to issue a new certificate."
      />
      <div className="card card-body py-4 overflow-hidden">
        <Stepper
          steps={WIZARD_STEPS}
          current={activeStep}
          completed={stepCompleted}
          onSelect={handleStepSelect}
          disabled={canReachStep}
        />
      </div>

      {formErrors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800 mb-2">Please fix the following errors:</p>
          <ul className="list-disc list-inside space-y-0.5 text-sm text-red-700">
            {formErrors.map((e, i) => (<li key={i}>{e}</li>))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {wizardStep === 0 && (
          <div className="card card-body space-y-5">
            <h2 className="font-semibold text-gray-900 border-b pb-3">Recipient Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="label">Full Name *</label>
                <input
                  type="text"
                  className="input"
                  value={formData.recipient.name}
                  onChange={(e) => setFormData({ ...formData, recipient: { ...formData.recipient, name: e.target.value } })}
                  placeholder="e.g. Mohan Shahi"
                  maxLength={100}
                />
              </div>
              <div>
                <label className="label">Student ID</label>
                <input
                  type="text"
                  className="input bg-gray-50 text-gray-500 cursor-not-allowed"
                  value="Auto-generated on issue"
                  disabled
                  readOnly
                />
                <p className="text-xs text-gray-400 mt-1">
                  A unique Student ID is assigned automatically when this certificate is issued.
                </p>
              </div>
            </div>
          </div>
          )}

          {wizardStep === 1 && (
          <div className="card card-body space-y-5">
            <h2 className="font-semibold text-gray-900 border-b pb-3">Course Selection</h2>
            <p className="text-xs text-gray-500 -mt-3">
              Select a course to auto-fill the program title, duration, course modules, and provider text below.
              Recipient and result fields are left untouched.
            </p>

            {loadingCourses ? (
              <div className="border border-gray-200 rounded-lg p-6 flex items-center justify-center text-gray-500">
                <span className="spinner w-5 h-5 border-brand-navy border-t-transparent"></span>
                <span className="ml-3 text-sm">Loading course catalog...</span>
              </div>
            ) : coursesError ? (
              <div className="border border-red-200 bg-red-50 rounded-lg p-4">
                <p className="text-sm font-medium text-red-800 mb-1">Could not load course catalog</p>
                <p className="text-xs text-red-700 mb-3">{coursesError}</p>
                <button
                  type="button"
                  onClick={loadCourses}
                  className="btn-secondary text-xs py-1 px-3"
                >
                  Retry Load Courses
                </button>
              </div>
            ) : courses.length === 0 ? (
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
                <p className="text-sm text-gray-500 mb-3">
                  No courses are available in the catalog yet.
                </p>
                <button
                  type="button"
                  onClick={loadCourses}
                  className="btn-secondary text-xs py-1 px-3"
                >
                  Refresh Catalog
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="label">Course Catalog</label>
                  <select
                    className="input"
                    value={selectedCourseId}
                    onChange={(e) => handleCourseSelect(e.target.value)}
                  >
                    <option value="">— None (manual entry) —</option>
                    {courses.map((c) => (
                      <option
                        key={c.id}
                        value={c.id}
                        disabled={!c.active}
                      >
                        {c.active ? "" : "[INACTIVE] "}
                        {c.code} — {c.title}
                        {` (${c.duration}, ${c.modules.filter((m) => m.active !== false).length} modules)`}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedCourse && (
                  <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                        Course data loaded
                      </p>
                      <button
                        type="button"
                        onClick={() => handleCourseSelect("")}
                        className="text-xs text-emerald-700 hover:text-emerald-900 underline underline-offset-2 whitespace-nowrap"
                      >
                        Clear &amp; switch to manual
                      </button>
                    </div>
                    <p className="text-xs text-emerald-600 mb-3">
                      Program title, duration, and modules below are locked to this catalog entry.
                    </p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div>
                        <p className="text-xs text-emerald-600">Course Code</p>
                        <p className="font-mono font-medium text-emerald-900">{selectedCourse.code}</p>
                      </div>
                      <div>
                        <p className="text-xs text-emerald-600">Duration</p>
                        <p className="font-medium text-emerald-900">{selectedCourse.duration}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-emerald-600">Program Title</p>
                        <p className="font-medium text-emerald-900">
                          {selectedCourse.certificateTitle || selectedCourse.title}
                        </p>
                      </div>
                      {selectedCourse.providerName && (
                        <div className="col-span-2">
                          <p className="text-xs text-emerald-600">Provider / Issuer</p>
                          <p className="font-medium text-emerald-900">{selectedCourse.providerName}</p>
                        </div>
                      )}
                      {selectedCourse.certificateTemplateId && (
                        <div>
                          <p className="text-xs text-emerald-600">Template</p>
                          <p className="font-mono text-xs text-emerald-900">
                            {selectedCourse.certificateTemplateId}
                            {selectedCourse.certificateTemplateVersion
                              ? ` v${selectedCourse.certificateTemplateVersion}`
                              : ""}
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-emerald-600">Active Modules</p>
                        <p
                          className={`font-medium ${
                            formData.modules.length === EXACT_MODULE_COUNT
                              ? "text-emerald-900"
                              : "text-amber-800"
                          }`}
                        >
                          {selectedCourse.modules.filter((m) => m.active !== false).length}
                          {formData.modules.length !== EXACT_MODULE_COUNT && (
                            <span className="text-[10px] uppercase tracking-wide ml-1 text-amber-700 bg-amber-100 border border-amber-200 rounded px-1 py-0.5">
                              mismatch
                            </span>
                          )}
                        </p>
                      </div>
                      {selectedCourse.completionStatement && (
                        <div className="col-span-2">
                          <p className="text-xs text-emerald-600">Completion Statement</p>
                          <p className="text-sm text-emerald-900">{selectedCourse.completionStatement}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedCourse && (
                  isTemplateCompatible ? (
                    <div className="border border-emerald-300 bg-emerald-50 rounded-lg p-3">
                      <p className="text-sm font-semibold text-emerald-800 flex items-center gap-1.5">
                        Template compatible
                      </p>
                      <p className="text-xs text-emerald-700 mt-0.5">
                        Course &quot;{selectedCourse.code}&quot; provides exactly {EXACT_MODULE_COUNT} active modules —
                        matches the 4-column fixed layout of certificate v2.
                      </p>
                    </div>
                  ) : (
                    <div className="border-2 border-amber-400 bg-amber-50 rounded-lg p-3">
                      <p className="text-sm font-semibold text-amber-900 flex items-center gap-1.5">
                        Template incompatibility — Issue blocked
                      </p>
                      <p className="text-xs text-amber-800 mt-1.5 font-medium">
                        Course &quot;{selectedCourse.code}&quot; contains {formData.modules.length} active module{formData.modules.length !== 1 ? "s" : ""}.
                        The current certificate design (v2) supports exactly {EXACT_MODULE_COUNT} modules.
                      </p>
                      <ul className="mt-2 space-y-1 text-xs text-amber-700 list-disc list-inside">
                        {formData.modules.length < EXACT_MODULE_COUNT && (
                          <li>
                            {EXACT_MODULE_COUNT - formData.modules.length} additional module
                            {EXACT_MODULE_COUNT - formData.modules.length !== 1 ? "s are" : " is"}
                            required.
                          </li>
                        )}
                        {formData.modules.length > EXACT_MODULE_COUNT && (
                          <li>
                            {formData.modules.length - EXACT_MODULE_COUNT} extra module
                            {formData.modules.length - EXACT_MODULE_COUNT !== 1 ? "s must" : " must"}
                            be removed or merged.
                          </li>
                        )}
                        <li>
                          Alternatively, choose an approved alternate template that supports{" "}
                          {formData.modules.length}-module layouts.
                        </li>
                      </ul>
                      <p className="mt-2 text-[11px] text-amber-600 font-semibold uppercase tracking-wide">
                        Issue flow will reject this configuration server-side.
                      </p>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
          )}

          {wizardStep === 2 && (
          <div className="card card-body space-y-5">
            <div className="flex items-start justify-between border-b pb-3 gap-4">
              <div>
                <h2 className="font-semibold text-gray-900">Program &amp; Modules</h2>
                {selectedCourse && (
                  <p className="text-xs text-emerald-600 mt-0.5 inline-flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Locked from course &quot;{selectedCourse.code}&quot; — change course above to edit these values.
                  </p>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500 -mt-3">
              {selectedCourse
                ? "Values are auto-filled from the course catalog and read-only below. Select a different course or clear selection to edit."
                : "Enter program details manually, or select a course above for auto-fill."}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="label flex items-center gap-2">
                  Program Title *
                  {selectedCourse && (
                    <span className="text-[10px] uppercase tracking-wide text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 font-semibold">
                      from course
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  className={`input ${selectedCourse ? "bg-gray-50 text-gray-600 cursor-not-allowed" : ""}`}
                  value={formData.program.title}
                  onChange={(e) =>
                    !selectedCourse &&
                    setFormData({ ...formData, program: { ...formData.program, title: e.target.value } })
                  }
                  placeholder="e.g. Professional Computer & Digital Skills Program"
                  maxLength={200}
                  disabled={!!selectedCourse}
                  readOnly={!!selectedCourse}
                />
                {fuzzyCourseMatch && (
                  <div className="mt-2 flex items-start justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                    <p className="text-xs text-amber-800">
                      This looks similar to course catalog entry{" "}
                      <span className="font-medium">
                        {fuzzyCourseMatch.code} — {fuzzyCourseMatch.title}
                      </span>
                      . Consider selecting it instead.
                    </p>
                    <button
                      type="button"
                      onClick={() => setFuzzyDupDismissed(true)}
                      className="text-xs font-medium text-amber-700 hover:text-amber-900 shrink-0 underline underline-offset-2"
                      aria-label="Dismiss suggestion"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label className="label flex items-center gap-2">
                  Duration *
                  {selectedCourse && (
                    <span className="text-[10px] uppercase tracking-wide text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 font-semibold">
                      from course
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  className={`input ${selectedCourse ? "bg-gray-50 text-gray-600 cursor-not-allowed" : ""}`}
                  value={formData.program.duration}
                  onChange={(e) =>
                    !selectedCourse &&
                    setFormData({ ...formData, program: { ...formData.program, duration: e.target.value } })
                  }
                  placeholder="e.g. 3 Months"
                  maxLength={50}
                  disabled={!!selectedCourse}
                  readOnly={!!selectedCourse}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="label mb-0 flex items-center gap-2">
                  Course Modules ({formData.modules.length}/{EXACT_MODULE_COUNT}) *
                  {selectedCourse && (
                    <span className="text-[10px] uppercase tracking-wide text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 font-semibold">
                      {formData.modules.length} active
                    </span>
                  )}
                </label>
                <button
                  type="button"
                  onClick={addModule}
                  disabled={!!selectedCourse || formData.modules.length >= EXACT_MODULE_COUNT}
                  className="btn-secondary text-xs py-1 px-3 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  + Add Module
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Exactly {EXACT_MODULE_COUNT} modules are required for the v2 4-column certificate template.
                {selectedCourse && (
                  <span className="block mt-1 text-emerald-600">
                    Modules and their order are sourced from the canonical course catalog and cannot be manually edited.
                  </span>
                )}
              </p>
              {formData.modules.length === 0 && (
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center text-gray-400 text-sm">
                  No modules added. Click &quot;Add Module&quot; or select a preset course above.
                </div>
              )}
              <div className="space-y-3">
                {formData.modules.map((mod: CertificateModule, idx: number) => (
                  <div
                    key={idx}
                    className={`border rounded-lg p-3 ${
                      selectedCourse
                        ? "border-emerald-200 bg-emerald-50/40"
                        : "border-gray-200 bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`text-xs font-semibold ${
                          selectedCourse ? "text-emerald-700" : "text-gray-500"
                        }`}
                      >
                        Module #{idx + 1}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveModule(idx, -1)}
                          disabled={!!selectedCourse || idx === 0}
                          className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move up"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moveModule(idx, 1)}
                          disabled={!!selectedCourse || idx === formData.modules.length - 1}
                          className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move down"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => removeModule(idx)}
                          disabled={!!selectedCourse}
                          className={`p-1 ml-1 ${
                            selectedCourse
                              ? "text-gray-300 cursor-not-allowed"
                              : "text-red-400 hover:text-red-600"
                          }`}
                          title="Remove module"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        className={`input ${
                          selectedCourse ? "bg-white text-gray-700 cursor-not-allowed border-emerald-200" : ""
                        }`}
                        placeholder={`Module ${idx + 1} Title *`}
                        value={mod.title}
                        onChange={(e) => updateModule(idx, "title", e.target.value)}
                        maxLength={45}
                        disabled={!!selectedCourse}
                        readOnly={!!selectedCourse}
                      />
                      <input
                        type="text"
                        className={`input ${
                          selectedCourse ? "bg-white text-gray-700 cursor-not-allowed border-emerald-200" : ""
                        }`}
                        placeholder="Subtitle / Description"
                        value={mod.subtitle || ""}
                        onChange={(e) => updateModule(idx, "subtitle", e.target.value)}
                        maxLength={80}
                        disabled={!!selectedCourse}
                        readOnly={!!selectedCourse}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          )}

          {wizardStep === 3 && (
          <div className="card card-body space-y-5">
            <h2 className="font-semibold text-gray-900 border-b pb-3">Results &amp; Dates</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="label">Grade / Result (optional)</label>
                <select
                  className="input"
                  value={formData.grade || ""}
                  onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                >
                  <option value="">— Not displayed —</option>
                  {["A+", "A", "B+", "B", "C+", "C", "D", "PASS", "FAIL"].map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Completion Date (optional)</label>
                <input
                  type="date"
                  className="input"
                  value={formData.completionDate || ""}
                  onChange={(e) => setFormData({ ...formData, completionDate: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Issue Date *</label>
                <input
                  type="date"
                  className="input"
                  value={formData.issueDate}
                  onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                  required
                />
              </div>
            </div>
          </div>
          )}

          {wizardStep === 4 && (
          <>
          <div className="card card-body space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="font-semibold text-gray-900">Authorized Signatory</h2>
              {!loadingSignatories && signatories.length > 0 && (
                <select className="input w-auto py-1 text-xs" onChange={(e) => handleSignatorySelect(e.target.value)} defaultValue="">
                  <option value="">Select signatory...</option>
                  {signatories.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} — {s.position}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Signatory Name *</label>
                <input
                  type="text"
                  className="input"
                  value={formData.signatory.name}
                  onChange={(e) => setFormData({ ...formData, signatory: { ...formData.signatory, name: e.target.value } })}
                  placeholder="Full name of authorized signatory"
                />
              </div>
              <div>
                <label className="label">Signatory Position *</label>
                <input
                  type="text"
                  className="input"
                  value={formData.signatory.position}
                  onChange={(e) => setFormData({ ...formData, signatory: { ...formData.signatory, position: e.target.value } })}
                  placeholder="e.g. Director, DarbarTech Group"
                />
              </div>
            </div>
          </div>

          <div className="card card-body space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="font-semibold text-gray-900">Secondary Signatory (Managing Director)</h2>
              {!loadingSignatories && signatories.length > 0 && (
                <select
                  className="input w-auto py-1 text-xs"
                  value={formData.secondarySignatory?.id || ""}
                  onChange={(e) => handleSecondarySignatorySelect(e.target.value)}
                >
                  <option value="">Select secondary signatory...</option>
                  {signatories.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} — {s.position}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Secondary Signatory Name *</label>
                <input
                  type="text"
                  className="input"
                  value={formData.secondarySignatory?.name || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, secondarySignatory: { ...(formData.secondarySignatory || { name: "", position: "" }), name: e.target.value } })
                  }
                  placeholder="Full name of secondary signatory"
                />
              </div>
              <div>
                <label className="label">Secondary Signatory Position *</label>
                <input
                  type="text"
                  className="input"
                  value={formData.secondarySignatory?.position || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, secondarySignatory: { ...(formData.secondarySignatory || { name: "", position: "" }), position: e.target.value } })
                  }
                  placeholder="e.g. Managing Director"
                />
              </div>
            </div>
          </div>
          </>
          )}

          <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setWizardStep((s) => Math.max(0, s - 1))}
              disabled={wizardStep === 0}
              className="btn-secondary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="inline-flex items-center gap-1.5">
                <Icon name="chevron-left" size={16} /> Back
              </span>
            </button>
            {wizardStep < 4 ? (
              <button
                type="button"
                onClick={() => setWizardStep((s) => s + 1)}
                disabled={!stepCompleted(wizardStep)}
                className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="inline-flex items-center gap-1.5">
                  Continue <Icon name="chevron-right" size={16} />
                </span>
              </button>
            ) : (
              <button type="submit" className="btn-primary">
                <span className="inline-flex items-center gap-1.5">
                  Review &amp; Generate Preview <Icon name="chevron-right" size={16} />
                </span>
              </button>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card card-body sticky top-24 space-y-4">
            <h3 className="font-semibold text-gray-900">Quick Actions</h3>
            <p className="text-xs text-gray-500">
              Review and validate your form, then generate a preview before issuing.
            </p>
            <div className="flex flex-col gap-2">
              <button type="submit" className="btn-primary w-full">
                Generate Preview
              </button>
              <Link href="/admin/certificates" className="btn-secondary w-full text-center">
                Cancel
              </Link>
            </div>
            <div className="pt-4 border-t border-gray-100 space-y-2 text-xs">
              <div className="flex justify-between text-gray-500">
                <span>Template</span>
                <span className="font-mono">darbartech v1.0.0</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Page</span>
                <span>A4 Landscape, 300 PPI</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Output</span>
                <span>Print-ready PDF</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
