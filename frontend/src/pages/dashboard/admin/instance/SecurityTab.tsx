import { useState } from "react";
import api from "../../../../lib/api";
import type { InstanceSettings } from "./InstancePage";

export default function SecurityTab({ settings, refetch }: { settings: InstanceSettings; refetch: () => void }) {
  const s = settings.security;
  const [form, setForm] = useState({
    force2FA: (s.force2FA as boolean) ?? false,
    sessionTimeout: (s.sessionTimeout as string) ?? "24h",
    allowedEmailDomains: (s.allowedEmailDomains as string) ?? "",
    maxLoginAttempts: (s.maxLoginAttempts as number) ?? 10,
    lockoutDuration: (s.lockoutDuration as string) ?? "15m",
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const isManaged = settings.isManaged;

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try { await api.patch("/admin/instance/security", form); setMsg("Saved"); refetch(); }
    catch { setMsg("Save failed"); } finally { setLoading(false); }
  };

  return (
    <form onSubmit={save} className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-void-text">Force 2FA</p>
          <p className="text-xs text-void-muted mt-0.5">Require all users to set up 2FA</p>
        </div>
        <button type="button" disabled={isManaged} onClick={() => setForm((f) => ({ ...f, force2FA: !f.force2FA }))}
          className={`relative w-10 h-5 shrink-0 border transition-colors disabled:opacity-50 ${form.force2FA ? "bg-void-accent border-void-accent" : "bg-void-surface-2 border-void-border"}`}>
          <span className={`absolute top-0.5 h-4 w-4 bg-white transition-all ${form.force2FA ? "left-5" : "left-0.5"}`} />
        </button>
      </div>
      <div>
        <label className="block text-sm text-void-muted mb-1">Session Timeout</label>
        <select value={form.sessionTimeout} onChange={(e) => setForm((f) => ({ ...f, sessionTimeout: e.target.value }))} disabled={isManaged}
          className="w-full px-3 py-2 bg-void-surface border border-void-border text-void-text text-sm focus:outline-none focus:border-void-accent disabled:opacity-50">
          {["1h","8h","24h","168h","720h"].map((v) => <option key={v} value={v}>{v === "168h" ? "7 days" : v === "720h" ? "30 days" : v}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm text-void-muted mb-1">Allowed Email Domains</label>
        <input type="text" value={form.allowedEmailDomains} onChange={(e) => setForm((f) => ({ ...f, allowedEmailDomains: e.target.value }))}
          disabled={isManaged} placeholder="e.g. company.com (empty = all)"
          className="w-full px-3 py-2 bg-void-surface border border-void-border text-void-text text-sm focus:outline-none focus:border-void-accent disabled:opacity-50" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-void-muted mb-1">Max Login Attempts</label>
          <input type="number" min="1" value={form.maxLoginAttempts} onChange={(e) => setForm((f) => ({ ...f, maxLoginAttempts: parseInt(e.target.value) }))}
            disabled={isManaged} className="w-full px-3 py-2 bg-void-surface border border-void-border text-void-text text-sm focus:outline-none focus:border-void-accent disabled:opacity-50" />
        </div>
        <div>
          <label className="block text-sm text-void-muted mb-1">Lockout Duration</label>
          <select value={form.lockoutDuration} onChange={(e) => setForm((f) => ({ ...f, lockoutDuration: e.target.value }))} disabled={isManaged}
            className="w-full px-3 py-2 bg-void-surface border border-void-border text-void-text text-sm focus:outline-none focus:border-void-accent disabled:opacity-50">
            {["5m","15m","1h","24h"].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </div>
      {!isManaged && (
        <>
          {msg && <p className={`text-xs ${msg === "Saved" ? "text-void-success" : "text-void-danger"}`}>{msg}</p>}
          <button type="submit" disabled={loading} className="px-4 py-2 bg-void-accent text-void-bg text-sm font-medium hover:bg-void-accent-dim disabled:opacity-50">
            {loading ? "Saving..." : "Save changes"}
          </button>
        </>
      )}
    </form>
  );
}
