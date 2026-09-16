"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import apiClient from "@/lib/api/client";
import type { PublicVerificationResponse } from "@/lib/types";
import { formatDateForDisplay } from "@/lib/renderer/dateFormatter";
import { Logo, Icon } from "@/components/ui";

export default function VerifyTokenPage({ params }: { params: { token: string } }) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<PublicVerificationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadVerification = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.verifyToken(params.token);
      setResult(response);
    } catch (err) {
      setError("Verification service unavailable. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [params.token]);

  useEffect(() => {
    loadVerification();
  }, [loadVerification]);

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
          <div className="flex items-center gap-4">
            <Link href="/verify" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-brand-navy transition-colors">
              <Icon name="search" size={15} />
              Verify by Number
            </Link>
            <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-brand-navy font-medium hover:underline">
              Admin
              <Icon name="chevron-right" size={14} />
            </Link>
          </div>
        </div>
      </header>

      <section className="flex-1 py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <p className="eyebrow-rules mx-auto mb-3 justify-center">Official · DarbarTech Group of Technology</p>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-brand-navy mb-3">
              Certificate Verification
            </h1>
            <p className="text-gray-500 text-sm">
              Public authenticity check — official from DarbarTech Group of Technology
            </p>
          </div>

          {loading ? (
            <div className="card p-12 text-center">
              <span className="spinner w-8 h-8 border-2 border-brand-navy border-t-transparent"></span>
              <p className="mt-4 text-gray-500 text-sm">Verifying certificate authenticity...</p>
            </div>
          ) : error ? (
            <div className="card card-body border-red-200 bg-red-50">
              <p className="text-red-700 text-sm">{error}</p>
              <button onClick={loadVerification} className="btn-secondary mt-4 text-sm">
                Retry Verification
              </button>
            </div>
          ) : !result ? (
            <div className="card p-12 text-center">
              <p className="text-gray-500">Unable to load verification result.</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              {result.status === "NOT_FOUND" ? (
                <div className="p-12 text-center">
                  <div className="w-20 h-20 mx-auto rounded-full bg-gray-100 flex items-center justify-center mb-6">
                    <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Certificate Not Found</h2>
                  <p className="text-gray-500 mb-6 max-w-md mx-auto text-sm leading-relaxed">
                    {result.message || "This verification link is invalid, expired, or the certificate record is not publicly available."}
                  </p>
                  <Link href="/verify" className="btn-primary">
                    Search by Certificate Number
                  </Link>
                </div>
              ) : result.certificate ? (
                <>
                  <div className={`px-8 py-5 ${result.status === "REVOKED" ? "bg-gradient-to-r from-red-700 to-red-600" : "bg-gradient-to-r from-brand-navy to-brand-blue"}`}>
                    <div className="max-w-2xl mx-auto flex items-center justify-between">
                      {renderStatusBadge(result.status)}
                      {result.status === "VALID" && (
                        <div className="text-white text-right hidden sm:block">
                          <p className="text-xs opacity-70 uppercase tracking-wide">Verified On</p>
                          <p className="font-mono text-sm">{formatDateForDisplay(new Date(), "MMM dd, yyyy HH:mm")}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="card-body p-8">
                    <div className="max-w-2xl mx-auto">
                      {result.status === "REVOKED" && result.certificate.revocationReason && (
                        <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-xs font-bold text-red-800 uppercase tracking-wide mb-2">Revocation Notice</p>
                          <p className="text-sm text-red-800 font-medium mb-1">Reason:</p>
                          <p className="text-sm text-red-700">{result.certificate.revocationReason}</p>
                          {result.certificate.revokedAt && (
                            <p className="text-xs text-red-600 mt-3 pt-2 border-t border-red-100">
                              This certificate was revoked on {formatDateForDisplay(result.certificate.revokedAt, "MMMM dd, yyyy")}
                            </p>
                          )}
                        </div>
                      )}

                      <div className="flex items-start gap-4 mb-8 pb-6 border-b border-gray-100">
                        <div className={`w-14 h-14 shrink-0 rounded-xl flex items-center justify-center ${result.status === "REVOKED" ? "bg-red-50 border-2 border-red-200" : "bg-brand-gold/10 border-2 border-brand-gold/40"}`}>
                          {result.status === "VALID" ? (
                            <Icon name="check" size={26} className="text-brand-gold" />
                          ) : (
                            <Icon name="remove" size={26} className="text-red-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <h2 className="font-display text-2xl sm:text-3xl font-bold text-gray-900">
                            {result.status === "VALID" ? "Certificate Verified" : "Certificate Has Been Revoked"}
                          </h2>
                          <p className="text-sm text-gray-500 mt-1.5">
                            {result.status === "VALID"
                              ? "This certificate has been issued by DarbarTech and is currently active."
                              : "This certificate has been officially revoked and is no longer valid."}
                          </p>
                        </div>
                      </div>

                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-6">
                        <div>
                          <dt className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Certificate No.</dt>
                          <dd className="font-mono font-bold text-brand-navy text-lg">{result.certificate.certificateNumber}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Grade / Result</dt>
                          <dd className="font-display font-bold text-xl text-brand-gold">{result.certificate.grade || "—"}</dd>
                        </div>
                        <div className="sm:col-span-2 pt-2">
                          <dt className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Recipient</dt>
                          <dd className="font-extrabold text-2xl text-gray-900">{result.certificate.recipientName}</dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Program / Course Title</dt>
                          <dd className="font-semibold text-lg text-gray-800">{result.certificate.programTitle}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Program Duration</dt>
                          <dd className="font-medium text-gray-900">{result.certificate.duration}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Date of Issue</dt>
                          <dd className="font-medium text-gray-900">{result.certificate.issueDate}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Completion Date</dt>
                          <dd className="font-medium text-gray-900">{result.certificate.completionDate || "—"}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Issued By</dt>
                          <dd className="font-medium text-gray-900">{result.certificate.issuer}</dd>
                        </div>
                        {result.certificate.trainingProvider && (
                          <div className="sm:col-span-2">
                            <dt className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Training Provider</dt>
                            <dd className="font-medium text-gray-900">{result.certificate.trainingProvider}</dd>
                          </div>
                        )}
                      </dl>

                      {result.certificate.modules && result.certificate.modules.length > 0 && (
                        <div className="mt-8 pt-6 border-t border-gray-100">
                          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-[0.2em] mb-5">
                            Course Modules
                          </h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {result.certificate.modules.map((m: any) => (
                              <div key={m.order} className="border border-gray-200 rounded-lg p-4 bg-surface-muted/60">
                                <div className="flex items-center gap-3 mb-1">
                                  <span
                                    className="inline-flex items-center justify-center w-7 h-7 rounded-md text-xs font-extrabold text-white bg-brand-navy"
                                  >
                                    {String(m.order).padStart(2, "0")}
                                  </span>
                                  <h4 className="font-display font-bold text-sm text-brand-navy uppercase tracking-wide">
                                    {m.title}
                                  </h4>
                                </div>
                                {m.subtitle && (
                                  <p className="text-xs mt-1 ml-10 text-brand-blue font-medium leading-relaxed">
                                    {m.subtitle}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="mt-10 pt-6 border-t border-gray-100 text-center space-y-2">
                        <p className="text-xs text-gray-500">
                          Certificate verified through the official DarbarTech verification portal.
                        </p>
                        <p className="text-[11px] text-gray-400">
                          Verification token: <code className="font-mono bg-gray-50 px-2 py-0.5 rounded border">{params.token.slice(0, 12)}...{params.token.slice(-8)}</code>
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

      <footer className="border-t border-gray-200 bg-white py-8 mt-auto">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm text-gray-500 space-y-1">
          <p className="font-medium text-gray-700">DarbarTech Group of Technology</p>
          <p>Official Certificate Verification System — v1.0.0</p>
          <p className="text-xs text-gray-400">© {new Date().getFullYear()} All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
