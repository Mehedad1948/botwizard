import type {
  CampaignStatus,
  DeliveryStatus,
  DestinationStatus,
} from "@prisma/client";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { CAMPAIGN_STATUS_LABELS } from "@/services/publishing/format";
import { DESTINATION_STATUS_LABELS } from "@/services/publishing/destinations";

const badgeBase =
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold";

const CAMPAIGN_TONES: Record<CampaignStatus, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700",
  PAUSED: "bg-amber-50 text-amber-700",
  COMPLETED: "bg-slate-100 text-slate-600",
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  return (
    <span className={cn(badgeBase, CAMPAIGN_TONES[status])}>
      <span className="size-1.5 rounded-full bg-current" />
      {CAMPAIGN_STATUS_LABELS[status]}
    </span>
  );
}

const DESTINATION_TONES: Record<DestinationStatus, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700",
  NO_PERMISSION: "bg-amber-50 text-amber-700",
  REMOVED: "bg-red-50 text-red-700",
};

export function DestinationStatusBadge({ status }: { status: DestinationStatus }) {
  return (
    <span className={cn(badgeBase, DESTINATION_TONES[status])}>
      {DESTINATION_STATUS_LABELS[status]}
    </span>
  );
}

const DELIVERY_LABELS: Record<DeliveryStatus, [string, string]> = {
  PENDING: ["در صف", "bg-sky-50 text-sky-700"],
  SENDING: ["در حال ارسال", "bg-sky-50 text-sky-700"],
  SENT: ["ارسال شد", "bg-emerald-50 text-emerald-700"],
  FAILED: ["ناموفق", "bg-red-50 text-red-700"],
  SKIPPED: ["رد شد", "bg-slate-100 text-slate-600"],
};

export function DeliveryStatusBadge({ status }: { status: DeliveryStatus }) {
  const [label, tone] = DELIVERY_LABELS[status];
  return <span className={cn(badgeBase, tone)}>{label}</span>;
}

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1.5">
        {back && (
          <Link
            href={back.href}
            className="text-sm text-muted-foreground transition hover:text-foreground"
          >
            → {back.label}
          </Link>
        )}
        <h1 className="text-2xl font-black tracking-tight text-slate-950">{title}</h1>
        {description && (
          <p className="text-sm leading-6 text-slate-500">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("dashboard-card rounded-2xl p-5", className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-base font-black text-slate-900">{title}</h2>}
            {description && (
              <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
            )}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-8 text-center">
      <p className="font-bold text-slate-800">{title}</p>
      {children && (
        <div className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{children}</div>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
