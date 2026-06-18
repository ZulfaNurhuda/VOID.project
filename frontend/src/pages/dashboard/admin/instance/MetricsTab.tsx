import { useState } from "react";
import api from "../../../../lib/api";
import type { InstanceSettings } from "./InstancePage";

export default function MetricsTab({ settings, refetch }: { settings: InstanceSettings; refetch: () => void }) {
  const m = settings.metrics;
  const [enabled, setEnabled]       = useState((m.enabled as boolean) ?? false);
  const [newToken, setNewToken]     = useState("");
  const [loading, setLoading]       = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [msg, setMsg]               = useState("");
  const isManaged = settings.isManaged;

  const save = async () => {
    setLoading(true);
    try { await api.patch("/admin/instance/metrics", { enabled }); setMsg("Saved"); refetch(); }
    catch { setMsg("Save failed"); } finally { setLoading(false); }
  };

  const regenerate = async () => {
    setGenLoading(true);
    try { const r = await api.post("/admin/instance/metrics/token"); setNewToken(r.data.bearerToken); }
    finally { setGenLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-void-text">Enable Metrics Endpoint</p>
          <p className="text-xs text-void-muted mt-0.5">Expose metrics at /api/metrics</p>
        </div>
        <button type="button" disabled={isManaged} onClick={() => setEnabled((v) => !v)}
          className={`relative w-10 h-5 shrink-0 border transition-colors disabled:opacity-50 ${enabled ? "bg-void-accent border-void-accent" : "bg-void-surface-2 border-void-border"}`}>
          <span className={`absolute top-0.5 h-4 w-4 bg-white transition-all ${enabled ? "left-5" : "left-0.5"}`} />
        </button>
      </div>
      <div>
        <label className="block text-sm text-void-muted mb-1">Metrics Endpoint</label>
        <input type="text" value="/api/metrics" readOnly
          className="w-full px-3 py-2 bg-void-surface-2 border border-void-border text-void-muted text-sm cursor-not-allowed font-mono" />
      </div>
      <div>
        <label className="block text-sm text-void-muted mb-1">Bearer Token</label>
        <p className="text-xs text-void-muted mb-2">Use Authorization: Bearer {"<token>"} to access /api/metrics</p>
        {newToken ? (
          <div className="p-3 border border-void-success/30 bg-void-success/5">
            <p className="text-xs text-void-success mb-1">New token (copy now — won't be shown again):</p>
            <code className="text-xs font-mono text-void-success break-all">{newToken}</code>
          </div>
        ) : (
          <p className="text-xs text-void-muted italic">Token is stored securely — regenerate to get a new one</p>
        )}
        <button type="button" onClick={regenerate} disabled={genLoading || isManaged}
          className="mt-2 px-3 py-1.5 border border-void-border text-void-muted text-xs hover:bg-void-surface-2 disabled:opacity-50 transition-colors">
          {genLoading ? "Generating..." : "Regenerate token"}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-void-border">
        {[
          { label: "Total Secrets", value: (m.totalSecrets as number | undefined) ?? "–" },
          { label: "Total Users",   value: (m.totalUsers as number | undefined) ?? "–" },
          { label: "Uptime",        value: (m.uptime as string | undefined) ?? "–" },
        ].map((stat) => (
          <div key={stat.label} className="p-3 bg-void-surface border border-void-border">
            <p className="text-xs text-void-muted mb-1">{stat.label}</p>
            <p className="text-sm font-medium text-void-text">{String(stat.value)}</p>
          </div>
        ))}
      </div>
      {!isManaged && (
        <>
          {msg && <p className={`text-xs ${msg === "Saved" ? "text-void-success" : "text-void-danger"}`}>{msg}</p>}
          <button type="button" onClick={save} disabled={loading}
            className="px-4 py-2 bg-void-accent text-void-bg text-sm font-medium hover:bg-void-accent-dim disabled:opacity-50">
            {loading ? "Saving..." : "Save changes"}
          </button>
        </>
      )}
    </div>
  );
}
