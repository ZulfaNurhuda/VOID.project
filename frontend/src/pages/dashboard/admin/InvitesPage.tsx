// frontend/src/pages/dashboard/admin/InvitesPage.tsx
import { Copy, Plus, Ticket, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import api from "../../../lib/api";

interface Invite {
  id: string;
  code: string;
  maxUses: number | null;
  useCount: number;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
  status: "active" | "depleted" | "expired" | "inactive";
}

const statusStyle: Record<string, string> = {
  active:   "bg-void-success/10 text-void-success",
  depleted: "bg-void-warning/10 text-void-warning",
  expired:  "bg-void-muted/10 text-void-muted",
  inactive: "bg-void-danger/10 text-void-danger",
};

export default function InvitesPage() {
  const [invites, setInvites]     = useState<Invite[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [maxUses, setMaxUses]     = useState("");
  const [expiresIn, setExpiresIn] = useState("7");
  const [creating, setCreating]   = useState(false);

  const fetchInvites = () => {
    setLoading(true);
    api.get("/admin/invites").then((r) => setInvites(r.data.invites ?? [])).finally(() => setLoading(false));
  };
  useEffect(fetchInvites, []);

  const copyCode = (code: string) => navigator.clipboard.writeText(code);

  const deactivate = async (id: string) => {
    await api.patch(`/admin/invites/${id}/status`);
    fetchInvites();
  };

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post("/admin/invites", {
        maxUses: maxUses ? parseInt(maxUses) : null,
        expiresInDays: expiresIn === "0" ? null : parseInt(expiresIn),
      });
      setShowModal(false);
      setMaxUses(""); setExpiresIn("7");
      fetchInvites();
    } finally { setCreating(false); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-void-text">Invites</h1>
          <p className="text-void-muted mt-1">Manage invite codes for registration</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-void-accent text-void-bg text-sm font-medium hover:bg-void-accent-dim transition-colors">
          <Plus size={14} /> Generate invite
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-6 w-6 animate-spin border-2 border-void-accent border-t-transparent rounded-full" />
        </div>
      ) : invites.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <Ticket size={32} className="text-void-muted mb-3" />
          <p className="text-void-muted text-sm">No invite codes. <span className="text-void-accent cursor-pointer" onClick={() => setShowModal(true)}>Generate an invite</span> to get started.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-void-border text-xs text-void-muted text-left">
                <th className="pb-3 pr-4 font-medium">Code</th>
                <th className="pb-3 pr-4 font-medium">Uses</th>
                <th className="pb-3 pr-4 font-medium">Expires</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 pr-4 font-medium">Created</th>
                <th className="pb-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((inv) => (
                <tr key={inv.id} className="border-b border-void-border/50 hover:bg-void-surface/50">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-xs text-void-text bg-void-surface-2 px-2 py-0.5">{inv.code}</code>
                      <button onClick={() => copyCode(inv.code)} className="text-void-muted hover:text-void-accent transition-colors" title="Copy"><Copy size={12} /></button>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-void-muted text-xs">{inv.useCount} / {inv.maxUses ?? "∞"}</td>
                  <td className="py-3 pr-4 text-void-muted text-xs">{inv.expiresAt ? new Date(inv.expiresAt).toLocaleDateString() : "Never"}</td>
                  <td className="py-3 pr-4">
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${statusStyle[inv.status] ?? ""}`}>{inv.status}</span>
                  </td>
                  <td className="py-3 pr-4 text-void-muted text-xs">{new Date(inv.createdAt).toLocaleDateString()}</td>
                  <td className="py-3">
                    <button onClick={() => deactivate(inv.id)} disabled={inv.status !== "active"}
                      className="text-void-muted hover:text-void-danger disabled:opacity-30 transition-colors" title="Deactivate">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm bg-void-surface border border-void-border p-6">
            <h3 className="text-base font-semibold text-void-text mb-4">Generate Invite Code</h3>
            <form onSubmit={generate} className="space-y-4">
              <div>
                <label className="block text-xs text-void-muted mb-1">Max Uses (empty = unlimited)</label>
                <input type="number" min="1" value={maxUses} onChange={(e) => setMaxUses(e.target.value)}
                  className="w-full px-3 py-2 bg-void-bg border border-void-border text-void-text text-sm focus:outline-none focus:border-void-accent" placeholder="Unlimited" />
              </div>
              <div>
                <label className="block text-xs text-void-muted mb-1">Expires In</label>
                <select value={expiresIn} onChange={(e) => setExpiresIn(e.target.value)}
                  className="w-full px-3 py-2 bg-void-bg border border-void-border text-void-text text-sm focus:outline-none focus:border-void-accent">
                  <option value="1">1 day</option>
                  <option value="3">3 days</option>
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                  <option value="0">Never</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-void-muted border border-void-border hover:bg-void-surface-2">Cancel</button>
                <button type="submit" disabled={creating} className="px-4 py-2 bg-void-accent text-void-bg text-sm font-medium hover:bg-void-accent-dim disabled:opacity-50">
                  {creating ? "Generating..." : "Generate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
