import Link from "next/link";
import { Logo, Icon } from "@/components/ui";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size={40} />
          </div>
          <nav className="flex items-center gap-4">
            <Link
              href="/verify"
              className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-brand-navy transition-colors"
            >
              <Icon name="verify" size={16} />
              Verify Certificate
            </Link>
            <Link href="/admin">
              <span className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-brand-navy text-white hover:bg-brand-blue transition-colors">
                <Icon name="lock" size={15} />
                Admin Login
              </span>
            </Link>
          </nav>
        </div>
      </header>

      <section className="flex-1 flex items-center justify-center py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-navy/5 border border-brand-navy/10 mb-8">
            <span className="w-2 h-2 rounded-full bg-brand-gold"></span>
            <span className="text-xs font-medium text-brand-navy">Official Certificate Verification</span>
          </div>

          <h2 className="text-4xl sm:text-5xl font-display font-bold text-brand-navy mb-6 tracking-tight">
            Programmable Certificate
            <br />
            <span className="text-brand-gold">Generation System</span>
          </h2>

          <p className="text-lg text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            Issue, verify, and manage professional certificates with design fidelity,
            QR-based verification, immutable audit history, and print-ready output.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link href="/admin" className="btn-primary px-8 py-3 text-base w-full sm:w-auto">
              Admin Panel
            </Link>
            <Link href="/verify" className="btn-secondary px-8 py-3 text-base w-full sm:w-auto">
              Verify a Certificate
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto text-left">
            <div className="card card-body">
              <div className="w-10 h-10 rounded-md bg-brand-navy/10 flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-brand-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="font-semibold text-brand-navy mb-2">QR Verification</h3>
              <p className="text-sm text-gray-600">
                Unique opaque tokens prevent enumeration. Scan any certificate for instant authenticity checks.
              </p>
            </div>

            <div className="card card-body">
              <div className="w-10 h-10 rounded-md bg-brand-gold/10 flex items-center justify-center mb-4">
                <svg className="w-5 h-5" style={{ color: "#c9a227" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </div>
              <h3 className="font-semibold text-brand-navy mb-2">Print-Ready PDF</h3>
              <p className="text-sm text-gray-600">
                A4 landscape output at 300 PPI equivalent. Embedded fonts, vector text, CMYK-ready workflow.
              </p>
            </div>

            <div className="card card-body">
              <div className="w-10 h-10 rounded-md bg-emerald-50 flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <h3 className="font-semibold text-brand-navy mb-2">Immutable Records</h3>
              <p className="text-sm text-gray-600">
                Full audit trail with DRAFT → PREVIEW → ISSUED → REVOKED/REISSUED lifecycle and template versioning.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-200 bg-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} DarbarTech Group of Technology. All rights reserved.</p>
          <p className="mt-2">
            Official certificate verification system | Template v1.0.0
          </p>
        </div>
      </footer>
    </main>
  );
}
