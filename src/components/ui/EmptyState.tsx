import { ReactNode } from "react";
import Link from "next/link";
import Icon, { IconName } from "./Icon";
import Button from "./Button";

export default function EmptyState({
  icon = "certificate",
  title,
  message,
  actionLabel,
  onAction,
  actionHref,
}: {
  icon?: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
}) {
  return (
    <div className="py-16 px-6 text-center animate-fade-in">
      <div className="mx-auto mb-5 inline-flex items-center justify-center w-14 h-14 rounded-full bg-brand-navy/5 border border-brand-navy/10">
        <Icon name={icon} size={26} className="text-brand-navy/60" />
      </div>
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      {message && <p className="mt-1.5 text-sm text-gray-500 max-w-sm mx-auto">{message}</p>}
      {actionLabel && (
        <div className="mt-5">
          {actionHref ? (
            <Link href={actionHref}>
              <Button>{actionLabel}</Button>
            </Link>
          ) : (
            <Button onClick={onAction}>{actionLabel}</Button>
          )}
        </div>
      )}
    </div>
  );
}