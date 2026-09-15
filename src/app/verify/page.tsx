"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import apiClient from "@/lib/api/client";
import type { PublicVerificationResponse } from "@/lib/types";
import { formatDateForDisplay } from "@/lib/renderer/dateFormatter";

type SearchState = "idle" | "loading" | "result";

export default function VerifyManualPage() {
  const [certificateNumber, setCertificateNumber] = useState("");
  const [state, setState] = useState<SearchState>("idle");
  const [result, setResult] = useState<PublicVerificationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!certificateNumber.trim()) return;
    setState("loading");
    setError(null);
    setResult(null);
    try {
      const response = await apiClient.manualVerify(certificateNumber.trim().toUpperCase());
      setResult(response);
      setState("result");
    } catch (err) {
      setError("Verification service unavailable. Please try again later.");
      setState("result");
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "VALID":
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-sm font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span> VALID CERTIFICATE
        </span>;
      case "REVOKED":
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-800 text-sm font-semibold">
          <span className="w-2 h-2 rounded-full bg-red-500"></span> CERTIFICATE REVOKED
        </span>;
      case "NOT_FOUND":
      default:
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-sm font-semibold">
          <span className="w-2 h-2 rounded-full bg-gray-500"></span> NOT FOUND
        </span>;
    }
  };

  return (
    <main className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md border-2 border-brand-navy flex items-center justify-center bg-gray-50">
              <span className="text-brand-navy font-bold text-sm">D</span>
            </div>
            <div>
              <p className="font-bold text-brand-navy text-sm">DarbarTech</p>
              <p className="text-xs text-gray-400">Certificate Verification</p>
            </div>
          </Link>
          <Link href="/admin" className="text-sm text-gray-600 hover:text-brand-navy transition-colors">
            Admin Panel →
          </Link>
        </div>
      </header>

      <section className="flex-1 py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <h1 className="text-3xl sm:text-4xl font-bold text-brand-navy mb-4">
              Certificate Verification
            </h1>
            <p className="text-gray-600 max-w-xl mx-auto">
              Verify the authenticity of any DarbarTech certificate. Enter the certificate number
              below or scan the QR code printed on the certificate.
            </p>
          </div>

          <div className="card card-body mb-8">
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                className="input flex-1 sm:py-3"
                placeholder="Enter certificate number (e.g. DT-CERT-2026-00125)"
                value={certificateNumber}
                onChange={(e) => setCertificateNumber(e.target.value)}
                disabled={state === "loading"}
                autoComplete="off"
                pattern="^[A-Za-z0-9-]+$"
              />
              <button
                type="submit"
                className="btn-primary sm:py-3 px-8"
                disabled={state === "loading" || !certificateNumber.trim()}
              >
                {state === "loading" ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="spinner"></span> Verifying...
                  </span>
                ) : (
                  "Verify"
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
                  <div className={`px-8 py-5 ${result.status === "REVOKED" ? "bg-red-600" : "bg-emerald-600"}`}>
                    <div className="max-w-2xl mx-auto">
                      {renderStatusBadge(result.status)}
                    </div>
                  </div>
                  <div className="card-body p-8">
                    <div className="max-w-2xl mx-auto">
                      {result.status === "REVOKED" && result.certificate.revocationReason && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-sm font-medium text-red-800 mb-1">Revocation Details</p>
                          <p className="text-sm text-red-700">Reason: {result.certificate.revocationReason}</p>
                          {result.certificate.revokedAt && (
                            <p className="text-xs text-red-600 mt-2">
                              Revoked on {formatDateForDisplay(result.certificate.revokedAt)}
                            </p>
                          )}
                        </div>
                      )}

                      <div className="flex items-start gap-3 mb-8 pb-6 border-b border-gray-100">
                        <div className="w-12 h-12 shrink-0 rounded-lg border-2 border-brand-navy flex items-center justify-center bg-brand-navy/5">
                          <svg className="w-6 h-6 text-brand-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                          </svg>
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-gray-900">Certificate Details</h2>
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
                          <dd className="font-semibold" style={{ color: "#c9a227" }}>{result.certificate.grade || "—"}</dd>
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
