import Link from "next/link";
import type { AuditFooterData } from "@/lib/audit/footer";

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AuditFooter({ data, historyHref }: { data: AuditFooterData; historyHref?: string }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-3 text-[11.5px] text-muted">
      <span>
        Created by <span className="text-ink2">{data.createdBy}</span> · {formatTimestamp(data.createdAt)}
      </span>
      {data.changedBy && data.changedAt && (
        <span>
          · Last changed by <span className="text-ink2">{data.changedBy}</span> · {formatTimestamp(data.changedAt)}
        </span>
      )}
      {historyHref && (
        <Link href={historyHref} className="font-medium text-accent hover:underline">
          View history ({data.eventCount}) →
        </Link>
      )}
    </div>
  );
}
