import { useState } from "react";
import api from "../../../../lib/api";
import type { InstanceSettings } from "./InstancePage";

export default function GeneralTab({ settings, refetch }: { settings: InstanceSettings; refetch: () => void }) {
  const g = settings.general;
  const [instanceName, setInstanceName] = useState((g.instanceName as string) ?? "");
  const [description, setDescription]  = useState((g.description as string) ?? "");
  const [logoBase64, setLogoBase64]     = useState((g.logoBase64 as string) ?? "");
  const [loading, setLoading]           = useState(false);
  const [msg, setMsg]                   = useState("");
  const isManaged = settings.isManaged;

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 512 * 1024) { setMsg("Logo must be under 512KB"); return; }
    const reader = new FileReader();
    reader.onload = () => setLogoBase64(reader.result as string);
    reader.readAsDataURL(file);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setMsg("");
    try {
      await api.patch("/admin/instance/general", { instanceName, description, logoBase64 });
      setMsg("Saved"); refetch();
    } catch { setMsg("Save failed"); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={save} className="space-y-5">
      <div>
        <label className="block text-sm text-void-muted mb-1">Instance Name</label>
        <input type="text" value={instanceName} onChange={(e) => setInstanceName(e.target.value)} disabled={isManaged}
          className="w-full px-3 py-2 bg-void-surface border border-void-border text-void-text text-sm focus:outline-none focus:border-void-accent disabled:opacity-50" />
      </div>
      <div>
        <label className="block text-sm text-void-muted mb-1">Instance URL</label>
        <input type="text" value={typeof window !== "undefined" ? window.location.origin : ""} readOnly
          className="w-full px-3 py-2 bg-void-surface-2 border border-void-border text-void-muted text-sm cursor-not-allowed" />
      </div>
      <div>
        <label className="block text-sm text-void-muted mb-1">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} disabled={isManaged}
          className="w-full px-3 py-2 bg-void-surface border border-void-border text-void-text text-sm focus:outline-none focus:border-void-accent disabled:opacity-50 resize-none" />
      </div>
      <div>
        <label className="block text-sm text-void-muted mb-1">Logo (PNG/JPEG/GIF/SVG/WebP, max 512KB)</label>
        {logoBase64 && <img src={logoBase64} alt="Logo" className="h-12 mb-2 object-contain" />}
        <input type="file" accept="image/png,image/jpeg,image/gif,image/svg+xml,image/webp" onChange={handleLogoUpload} disabled={isManaged}
          className="text-sm text-void-muted file:mr-3 file:px-3 file:py-1 file:bg-void-surface-2 file:border file:border-void-border file:text-void-muted file:text-xs disabled:opacity-50" />
      </div>
      {!isManaged && (
        <>
          {msg && <p className={`text-xs ${msg === "Saved" ? "text-void-success" : "text-void-danger"}`}>{msg}</p>}
          <button type="submit" disabled={loading}
            className="px-4 py-2 bg-void-accent text-void-bg text-sm font-medium hover:bg-void-accent-dim disabled:opacity-50 transition-colors">
            {loading ? "Saving..." : "Save changes"}
          </button>
        </>
      )}
    </form>
  );
}
