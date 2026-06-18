import { useState } from "react";
import api from "../../../../lib/api";
import type { InstanceSettings } from "./InstancePage";

export default function OrganizationTab({ settings, refetch }: { settings: InstanceSettings; refetch: () => void }) {
  const o = settings.organization;
  const [form, setForm] = useState({
    registrationMode: (o.registrationMode as string) ?? "open",
    disableEmailSignup: (o.disableEmailSignup as boolean) ?? false,
    allowedEmailDomains: (o.allowedEmailDomains as string) ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const isManaged = settings.isManaged;

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try { await api.patch("/admin/instance/organization", form); setMsg("Saved"); refetch(); }
    catch { setMsg("Save failed"); } finally { setLoading(false); }
  };

  return (
    <form onSubmit={save} className="space-y-6">
      <div>
        <label className="block text-sm text-void-muted mb-2">Registration Mode</label>
        <div className="space-y-2">
          {[
            { value: "open",        label: "Open — anyone can register" },
            { value: "invite-only", label: "Invite Only — requires a valid invite code" },
            { value: "closed",      label: "Closed — no new registrations" },
          ].map((opt) => (
            <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
              <input type="radio" value={opt.value} checked={form.registrationMode === opt.value}
                onChange={() => setForm((f) => ({ ...f, registrationMode: opt.value }))} disabled={isManaged} className="accent-void-accent" />
              <span className="text-sm text-void-text">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-void-text">Disable Email/Password Signup</p>
          <p className="text-xs text-void-muted mt-0.5">Only OAuth providers can be used to sign in</p>
        </div>
        <button type="button" disabled={isManaged} onClick={() => setForm((f) => ({ ...f, disableEmailSignup: !f.disableEmailSignup }))}
          className={`relative w-10 h-5 shrink-0 border transition-colors disabled:opacity-50 ${form.disableEmailSignup ? "bg-void-accent border-void-accent" : "bg-void-surface-2 border-void-border"}`}>
          <span className={`absolute top-0.5 h-4 w-4 bg-white transition-all ${form.disableEmailSignup ? "left-5" : "left-0.5"}`} />
        </button>
      </div>
      <div>
        <label className="block text-sm text-void-muted mb-1">Allowed Email Domains</label>
        <input type="text" value={form.allowedEmailDomains} onChange={(e) => setForm((f) => ({ ...f, allowedEmailDomains: e.target.value }))}
          disabled={isManaged} placeholder="e.g. company.com, example.org (empty = all)"
          className="w-full px-3 py-2 bg-void-surface border border-void-border text-void-text text-sm focus:outline-none focus:border-void-accent disabled:opacity-50" />
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
