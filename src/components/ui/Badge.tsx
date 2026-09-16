import { ReactNode } from "react";

export type BadgeTone =
  | "slate"
  | "cyan"
  | "issued"
  | "green"
  | "red"
  | "amber"
  | "gray"
  | "navy";

const TONES: Record<BadgeTone, string> = {
  slate: "bg-slate-100 text-slate-700",
  cyan: "bg-brand-cyan/10 text-brand-blue",
  issued: "bg-brand-gold/15 text-brand-gold",
  green: "bg-emerald-100 text-emerald-800",
  red: "bg-red-100 text-red-800",
  amber: "bg-amber-100 text-amber-800",
  gray: "bg-gray-100 text-gray-500",
  navy: "bg-brand-navy/8 text-brand-navy",
};

export default function Badge({
  tone = "slate",
  dot,
  children,
  className = "",
}: {
  tone?: BadgeTone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${TONES[tone]} ${className}`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export const statusToTone = (status: string): BadgeTone => {
  switch (status) {
    case "DRAFT":
      return "slate";
    case "PREVIEW":
      return "cyan";
    case "ISSUED":
      return "issued";
    case "REVOKED":
      return "red";
    case "REISSUED":
      return "amber";
    case "CANCELLED":
      return "gray";
    default:
      return "slate";
  }
};