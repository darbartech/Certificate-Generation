import { HTMLAttributes, ReactNode } from "react";

export function Card({
  accent,
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & {
  accent?: "navy" | "gold" | "red" | "cyan" | null;
  children: ReactNode;
}) {
  const accentBar =
    accent === "navy"
      ? "border-t-2 border-t-brand-navy"
      : accent === "gold"
        ? "border-t-2 border-t-brand-gold"
        : accent === "red"
          ? "border-t-2 border-t-red-500"
          : accent === "cyan"
            ? "border-t-2 border-t-brand-cyan"
            : "";
  return (
    <div className={`card ${accentBar} ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`card-header ${className}`}>{children}</div>;
}

export function CardBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`card-body ${className}`}>{children}</div>;
}

export function CardTitle({
  children,
  subtitle,
}: {
  children: ReactNode;
  subtitle?: string;
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-900">{children}</h2>
      {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}