import { ReactNode } from "react";
import Icon, { IconName } from "./Icon";

type AlertVariant = "info" | "success" | "warning" | "error";

const STYLES: Record<AlertVariant, { wrap: string; icon: string; iconName: IconName }> = {
  info: {
    wrap: "border-brand-cyan/30 bg-brand-cyan/5 text-brand-blue",
    icon: "text-brand-cyan",
    iconName: "info",
  },
  success: {
    wrap: "border-emerald-200 bg-emerald-50 text-emerald-800",
    icon: "text-emerald-600",
    iconName: "check",
  },
  warning: {
    wrap: "border-amber-200 bg-amber-50 text-amber-900",
    icon: "text-amber-600",
    iconName: "warning",
  },
  error: {
    wrap: "border-red-200 bg-red-50 text-red-800",
    icon: "text-red-600",
    iconName: "alert",
  },
};

export default function Alert({
  variant = "info",
  title,
  children,
  action,
  className = "",
}: {
  variant?: AlertVariant;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const s = STYLES[variant];
  return (
    <div
      role="alert"
      className={`rounded-lg border px-3.5 py-3 text-sm flex items-start gap-2.5 ${s.wrap} ${className}`}
    >
      <Icon name={s.iconName} size={17} className={`mt-0.5 shrink-0 ${s.icon}`} />
      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? "mt-0.5 text-[13px] leading-relaxed" : "leading-relaxed"}>{children}</div>}
      </div>
      {action}
    </div>
  );
}