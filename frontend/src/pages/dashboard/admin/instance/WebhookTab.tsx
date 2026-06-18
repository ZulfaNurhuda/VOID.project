import { useState } from "react";
import api from "../../../../lib/api";
import type { InstanceSettings } from "./InstancePage";

const EVENTS = [
  { id: "secret.created",  label: "Secret created" },
  { id: "secret.accessed", label: "Secret accessed" },
  { id: "secret.deleted",  label: "Secret deleted" },
  { id: "user.joined",     label: "User joined" },
  { id: "team.created",    label: "Team created" },
];

export default function WebhookTab({ settings, refetch }: { settings: InstanceSettings; refetch: () => void }) {
  const w = settings.webhook;
  const [form, setForm] = useState({
    enabled: (w.enabled as boolean) ?? false,
    url: (w.url as string) ?? "",
    secret: (w.secret as string) ?? "",
    events: (w.events as string[]) ?? [],
  });
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState("");
  const isManaged = settings.isManaged;

  const toggleEvent = (id: string) => {
    setForm((f) => ({ ...f, events: f.events.includes(id) ? f.events.filter((e) => e !== id) : [...f.events, id] }));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try { await api.patch("/admin/instance/webhooks", form); setMsg("Saved"); refetch(); }
    catch { setMsg("Save failed"); } finally { setLoading(false); }
  };

  const test = async () => {
    setTesting(true);
    try { await api.post("/admin/instance/webhooks/test"); setMsg("Test ping sent"); }
    catch { setMsg("Test failed"); } finally { setTesting(false); }
  };

  return (
    <form onSubmit={save} className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-void-text">Enable Webhooks</p>
          <p className="text-xs text-void-muted mt-0.5">Receive HTTP POST notifications for events</p>
        </div>
        <button type="button" disabled={isManaged} onClick={() => setForm((f) => ({ ...f, enabled: !f.enabled }))}
          className={`relative w-10 h-5 shrink-0 border transition-colors disabled:opacity-50 ${form.enabled ? "bg-void-accent border-void-accent" : "bg-void-surface-2 border-void-border"}`}>
          <span className={`absolute top-0.5 h-4 w-4 bg-white transition-all ${form.enabled ? "left-5" : "left-0.5"}`} />
        </button>
      </div>
      <div>
        <label className="block text-sm text-void-muted mb-1">Webhook URL</label>
        <input type="url" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
          disabled={isManaged} placeholder="https://example.com/webhook"
          className="w-full px-3 py-2 bg-void-surface border border-void-border text-void-text text-sm focus:outline-none focus:border-void-accent disabled:opacity-50" />
      </div>
      <div>
        <label className="block text-sm text-void-muted mb-1">Webhook Secret</label>
        <input type="password" value={form.secret} onChange={(e) => setForm((f) => ({ ...f, secret: e.target.value }))}
          disabled={isManaged} placeholder="Used for HMAC signature"
          className="w-full px-3 py-2 bg-void-surface border border-void-border text-void-text text-sm focus:outline-none focus:border-void-accent disabled:opacity-50" />
      </div>
      <div>
        <label className="block text-sm text-void-muted mb-2">Event Triggers</label>
        <div className="space-y-2">
          {EVENTS.map((ev) => (
            <label key={ev.id} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.events.includes(ev.id)} onChange={() => toggleEvent(ev.id)} disabled={isManaged} className="accent-void-accent" />
              <span className="text-sm text-void-text">{ev.label}</span>
            </label>
          ))}
        </div>
      </div>
      {!isManaged && (
        <div className="flex items-center gap-3">
          <button type="submit" disabled={loading} className="px-4 py-2 bg-void-accent text-void-bg text-sm font-medium hover:bg-void-accent-dim disabled:opacity-50">
            {loading ? "Saving..." : "Save changes"}
          </button>
          <button type="button" onClick={test} disabled={testing || !form.url}
            className="px-4 py-2 border border-void-border text-void-muted text-sm hover:bg-void-surface-2 disabled:opacity-50 transition-colors">
            {testing ? "Sending..." : "Test webhook"}
          </button>
        </div>
      )}
      {msg && <p className={`text-xs ${msg.includes("failed") ? "text-void-danger" : "text-void-success"}`}>{msg}</p>}
    </form>
  );
}
