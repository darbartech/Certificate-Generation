import { ButtonHTMLAttributes, ReactNode } from "react";
import Icon, { IconName } from "./Icon";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success" | "gold";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand-navy text-white hover:bg-brand-blue focus-visible:ring-brand-navy border border-transparent",
  secondary:
    "bg-white border border-gray-300 text-gray-700 hover:bg-slate-50 hover:border-gray-400 focus-visible:ring-gray-300",
  ghost: "bg-transparent border border-transparent text-gray-600 hover:bg-slate-100 focus-visible:ring-gray-300",
  danger: "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500 border border-transparent",
  success: "bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500 border border-transparent",
  gold: "bg-brand-gold text-white hover:opacity-90 focus-visible:ring-brand-gold border border-transparent",
};

const SIZES: Record<Size, string> = {
  sm: "px-2.5 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
  lg: "px-6 py-2.5 text-base gap-2",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconLeft?: IconName;
  loading?: boolean;
  block?: boolean;
};

export default function Button({
  variant = "primary",
  size = "md",
  icon,
  iconLeft,
  loading,
  block,
  disabled,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={[
        "inline-flex items-center justify-center rounded-md font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        block ? "w-full" : "",
        className,
      ].join(" ")}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span className="spinner" />
      ) : iconLeft ? (
        <Icon name={iconLeft} size={size === "sm" ? 14 : 16} />
      ) : null}
      {children}
      {icon && !loading ? <Icon name={icon} size={size === "sm" ? 14 : 16} /> : null}
    </button>
  );
}