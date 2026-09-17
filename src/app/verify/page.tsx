"use client";

import { useState, useEffect, FormEvent } from "react";
import Link from "next/link";
import apiClient from "@/lib/api/client";
import type { PublicVerificationResponse } from "@/lib/types";
import { formatDateForDisplay } from "@/lib/renderer/dateFormatter";
import { Logo, Icon } from "@/components/ui";

type SearchState = "idle" | "loading" | "result";

export default function VerifyManualPage() {
  const [certificateNumber, setCertificateNumber] = useState("");
  const [state, setState] = useState<SearchState>("idle");
  const [result, setResult] = useState<PublicVerificationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runSearch = async (value: string) => {
    if (!value.trim()) return;
    setState("loading");
    setError(null);
    setResult(null);
    try {
      const response = await apiClient.manualVerify(value.trim().toUpperCase());
      setResult(response);
      setState("result");
    } catch (err) {
      setError("Verification service unavailable. Please try again later.");
      setState("result");
    }
  };

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    await runSearch(certificateNumber);
  };

  // Allow admin/verification links to deep-link a certificate number
  // (V2 §7: the raw token is no longer retrievable, so links carry the number).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const number = params.get("number");
    if (number) {
      setCertificateNumber(number);
      void runSearch(number);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "VALID":
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-gold/20 text-brand-gold text-sm font-bold tracking-wide">
          <span className="flex items-center justify-center w-4 h-4 rounded-full bg-brand-gold text-white">
            <Icon name="check" size={11} />
          </span> VALID CERTIFICATE
        </span>;
      case "REVOKED":
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-900 text-sm font-bold tracking-wide">
          <span className="w-2 h-2 rounded-full bg-red-600"></span> CERTIFICATE REVOKED
        </span>;
      case "SUPERSEDED":
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-sm font-bold tracking-wide">
          <span className="w-2 h-2 rounded-full bg-amber-600"></span> CERTIFICATE SUPERSEDED
        </span>;
      case "NOT_FOUND":
      default:
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-sm font-semibold">
          <span className="w-2 h-2 rounded-full bg-gray-500"></span> NOT FOUND
        </span>;
    }
  };

  return (
    <main className="min-h-screen flex flex-col bg-gradient-to-b from-surface-muted to-white">
      <header className="bg-white/95 backdrop-blur border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size={36} />
            <span className="flex flex-col leading-none">
              <span className="text-[13px] font-bold tracking-tight">
                <span className="text-brand-navy">Darbar</span>
                <span className="text-brand-blue">Tech</span>
              </span>
              <span className="mt-1 text-[8.5px] font-medium uppercase tracking-[0.2em] text-gray-400">
                Certificate Verification
              </span>
            </span>
          </Link>
          <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-brand-navy font-medium hover:underline">
            Admin
            <Icon name="chevron-right" size={14} />
          </Link>
        </div>
      </header>

      <section className="flex-1 py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <p className="eyebrow-rules mx-auto mb-3 justify-center">Official · DarbarTech Group of Technology</p>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-brand-navy mb-4">
              Certificate Verification
            </h1>
            <p className="text-gray-600 max-w-xl mx-auto">
              Verify the authenticity of any DarbarTech certificate. Enter the certificate number
              below or scan the QR code printed on the certificate.
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-card mb-8">
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <Icon name="search" size={18} />
                </span>
                <input
                  type="text"
                  className="input pl-10 sm:py-3"
                  placeholder="Enter certificate number (e.g. DT-CERT-2026-00125)"
                  value={certificateNumber}
                  onChange={(e) => setCertificateNumber(e.target.value)}
                  disabled={state === "loading"}
                  autoComplete="off"
                  pattern="^[A-Za-z0-9-]+$"
                  aria-label="Certificate number"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-navy text-white px-8 sm:py-3 py-2.5 text-sm font-medium hover:bg-brand-blue transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={state === "loading" || !certificateNumber.trim()}
              >
                {state === "loading" ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="spinner"></span> Verifying...
                  </span>
                ) : (
                  <>
                    Verify
                    <Icon name="chevron-right" size={15} />
                  </>
                )}
              </button>
            </form>
          </div>

          {error && (
            <div className="card card-body border-red-200 bg-red-50 mb-6">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {state === "result" && result && (
            <div className="card overflow-hidden">
              {result.status === "NOT_FOUND" ? (
                <div className="p-12 text-center">
                  <div className="w-20 h-20 mx-auto rounded-full bg-gray-100 flex items-center justify-center mb-6">
                    <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Certificate Not Found</h2>
                  <p className="text-gray-500 mb-6 max-w-md mx-auto">
                    {result.message || "We couldn't find a certificate matching the number you entered. Please check the number and try again."}
                  </p>
                  <div className="text-sm text-gray-500 space-y-1">
                    <p>Double-check the certificate number format.</p>
                    <p>Expected format: <code className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">DT-CERT-YYYY-NNNNN</code></p>
                  </div>
                </div>
              ) : result.certificate ? (
                <>
                  <div className={`px-8 py-5 ${
                    result.status === "REVOKED"
                      ? "bg-gradient-to-r from-red-700 to-red-600"
                      : result.status === "SUPERSEDED"
                        ? "bg-gradient-to-r from-amber-700 to-amber-600"
                        : "bg-gradient-to-r from-brand-navy to-brand-blue"
                  }`}>
                    <div className="max-w-2xl mx-auto">
                      {renderStatusBadge(result.status)}
                    </div>
                  </div>
                  <div className="card-body p-8">
                    <div className="max-w-2xl mx-auto">
                      {(result.status === "REVOKED" || result.status === "SUPERSEDED") && (
                        <div className={`mb-6 p-4 rounded-lg border ${
                          result.status === "REVOKED"
                            ? "bg-red-50 border-red-200"
                            : "bg-amber-50 border-amber-200"
                        }`}>
                          <p className={`text-sm font-medium ${
                            result.status === "REVOKED" ? "text-red-800" : "text-amber-800"
                          } mb-1`}>
                            {result.status === "REVOKED"
                              ? "This certificate has been officially revoked and is no longer valid."
                              : "This certificate has been replaced by a newer certificate and is no longer current."}
                          </p>
                          {result.status === "REVOKED" && result.certificate.revokedAt && (
                            <p className="text-xs text-red-600 mt-2">
                              Revoked on {formatDateForDisplay(result.certificate.revokedAt)}
                            </p>
                          )}
                          {result.status === "SUPERSEDED" && result.certificate.supersededAt && (
                            <p className="text-xs text-amber-700 mt-2">
                              Superseded on {formatDateForDisplay(result.certificate.supersededAt)}
                            </p>
                          )}
                        </div>
                      )}

                      <div className="flex items-start gap-3 mb-8 pb-6 border-b border-gray-100">
<div className="w-12 h-12 shrink-0 rounded-lg bg-brand-navy/5 border-2 border-brand-navy/20 flex items-center justify-center">
                          <Icon name="shield" size={22} className="text-brand-navy" />
                        </div>
                        <div>
                          <h2 className="font-display text-2xl font-bold text-gray-900">Certificate Details</h2>
                          <p className="text-sm text-gray-500 mt-1">Issued by DarbarTech Group of Technology</p>
                        </div>
                      </div>

                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                        <div>
                          <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Certificate No.</dt>
                          <dd className="font-mono font-semibold text-brand-navy">{result.certificate.certificateNumber}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Grade</dt>
                          <dd className="font-display font-bold text-lg text-brand-gold">{result.certificate.grade || "—"}</dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Recipient</dt>
                          <dd className="font-bold text-lg text-gray-900">{result.certificate.recipientName}</dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Program</dt>
                          <dd className="font-medium text-gray-900">{result.certificate.programTitle}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Duration</dt>
                          <dd className="font-medium text-gray-900">{result.certificate.duration}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Completion Date</dt>
                          <dd className="font-medium text-gray-900">{result.certificate.completionDate || "—"}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Issue Date</dt>
                          <dd className="font-medium text-gray-900">{result.certificate.issueDate}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Issuer</dt>
                          <dd className="font-medium text-gray-900">{result.certificate.issuer}</dd>
                        </div>
                      </dl>

                      <div className="mt-10 pt-6 border-t border-gray-100">
                        <p className="text-xs text-gray-500 text-center">
                          This is an official electronically verified record from DarbarTech Group of Technology.
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>
      </section>

      <footer className="border-t border-gray-200 bg-white py-8">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} DarbarTech Group of Technology. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
