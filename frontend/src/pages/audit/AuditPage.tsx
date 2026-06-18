import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/components/shared/EmptyState";
import { auditApi } from "@/lib/api";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function AuditPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", page],
    queryFn: () => auditApi.list({ page: String(page), limit: "50" }),
  });

  const logs = data?.logs ?? [];

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-void-text text-xl font-semibold tracking-tight">
          Audit Logs
        </h1>
        <a
          href="/api/audit-logs/export"
          className="text-[13px] text-void-accent hover:text-void-accent-dim transition-colors"
          download
        >
          Export CSV
        </a>
      </div>

      {isLoading ? (
        <div className="text-void-muted text-sm py-8 text-center">
          Loading...
        </div>
      ) : logs.length === 0 ? (
        <EmptyState title="No audit logs yet" />
      ) : (
        <>
          <div className="border border-void-border rounded overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-void-surface border-b border-void-border">
                  {["Time", "Actor", "Action", "Resource"].map((h) => (
                    <th
                      key={h}
                      className="text-left px-3 py-2.5 text-void-muted font-medium text-xs uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-void-border last:border-0 hover:bg-void-surface transition-colors"
                  >
                    <td className="px-3 py-2.5 text-void-muted whitespace-nowrap">
                      {timeAgo(log.created_at)}
                    </td>
                    <td className="px-3 py-2.5 text-void-text">
                      {log.actor_name}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-void-accent text-xs">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-void-muted">
                      {log.resource_type ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center gap-2 mt-4 text-[13px] text-void-muted">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2 py-1 border border-void-border rounded disabled:opacity-40 hover:bg-void-surface transition-colors"
            >
              ←
            </button>
            <span>Page {page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={logs.length < 50}
              className="px-2 py-1 border border-void-border rounded disabled:opacity-40 hover:bg-void-surface transition-colors"
            >
              →
            </button>
          </div>
        </>
      )}
    </>
  );
}
