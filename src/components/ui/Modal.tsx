"use client";

import { ReactNode, useEffect, useRef } from "react";
import Icon from "./Icon";

export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = "max-w-lg",
  closeDisabled,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
  closeDisabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !closeDisabled) {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose, closeDisabled]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      ref.current?.querySelector<HTMLElement>("input, button, textarea, select, [tabindex]")?.focus();
    }, 30);
    return () => clearTimeout(timer);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-dark/50 p-4 py-10 backdrop-blur-[2px] animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={() => {
        if (!closeDisabled) onClose();
      }}
    >
      <div
        ref={ref}
        role="document"
        className={`card w-full ${maxWidth} shadow-pop animate-scale-in`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-header flex items-start justify-between gap-4 bg-surface-muted/60">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            aria-label="Close dialog"
            className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-slate-100 hover:text-gray-600 disabled:opacity-40"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-6">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-3 border-t border-gray-100 bg-surface-muted/40 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}