import { ReactNode } from "react";

export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 animate-fade-in">
      <div>
        {eyebrow && (
          <p className="eyebrow-rules mb-1.5 text-ink-faint">{eyebrow}</p>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-ink-muted">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}