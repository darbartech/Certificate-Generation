import { ReactNode } from "react";
import Icon, { IconName } from "./Icon";

const ACCENTS: Record<string, string> = {
  navy: "bg-brand-navy",
  cyan: "bg-brand-cyan",
  gold: "bg-brand-gold",
  blue: "bg-brand-blue",
  emerald: "bg-emerald-500",
  red: "bg-red-500",
  amber: "bg-amber-500",
};

export default function StatTile({
  icon,
  accent = "navy",
  label,
  value,
  valueClassName = "",
  delta,
  deltaUp,
  hint,
}: {
  icon: IconName;
  accent?: keyof typeof ACCENTS;
  label: string;
  value: ReactNode;
  valueClassName?: string;
  delta?: number | null;
  deltaUp?: boolean;
  hint?: string;
}) {
  return (
    <div className="card card-body relative overflow-hidden">
      <span className={`absolute inset-x-0 top-0 h-0.5 ${ACCENTS[accent] || ACCENTS.navy}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</p>
          <p className={`mt-1.5 text-2xl font-bold text-ink tabular-nums ${valueClassName}`}>{value}</p>
          {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
        </div>
        <span
          className={`shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg ${ACCENTS[accent] || ACCENTS.navy}/10`}
        >
          <Icon name={icon} size={18} className={ACCENTS[accent] || ACCENTS.navy} />
        </span>
      </div>
      {typeof delta === "number" && (
        <div className="mt-2 flex items-center gap-1 text-xs font-semibold">
          <Icon
            name={deltaUp !== false ? "arrow-up" : "arrow-down"}
            size={13}
            className={deltaUp !== false ? "text-emerald-600" : "text-red-600"}
          />
          <span className={deltaUp !== false ? "text-emerald-600" : "text-red-600"}>
            {Math.abs(delta)}%
          </span>
          <span className="font-normal text-gray-400">vs prior 30 days</span>
        </div>
      )}
    </div>
  );
}