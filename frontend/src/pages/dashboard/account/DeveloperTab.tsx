import { Copy, ExternalLink, Key, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import api from "../../../lib/api";

interface APIKey {
  id: string;
  name: string;
  prefix: string;
  lastUsed?: string;
  createdAt: string;
}

export default function DeveloperTab() {
  const [keys, setKeys]           = useState<APIKey[]>([]);
  const [name, setName]           = useState("");
  const [loading, setLoading]     = useState(false);
  const [newKey, setNewKey]       = useState(""); // shown once after creation
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    api.get("/user/api-keys").then((r) => setKeys(r.data.apiKeys ?? []));
  }, []);

  const createKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await api.post("/user/api-keys", { name });
      setNewKey(r.data.key);
      setKeys((k) => [{ id: r.data.id, name: r.data.name, prefix: r.data.prefix, createdAt: r.data.createdAt }, ...k]);
      setName("");
      setShowModal(false);
    } finally {
      setLoading(false);
    }
  };

  const deleteKey = async (id: string) => {
    await api.delete(`/user/api-keys/${id}`);
    setKeys((k) => k.filter((x) => x.id !== id));
  };

  return (
    <div className="space-y-8">
      {/* New key shown once */}
      {newKey && (
        <div className="p-4 border border-void-success/30 bg-void-success/5 space-y-2">
          <p className="text-sm font-medium text-void-text">API Key created — copy it now, it won't be shown again</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono text-void-success bg-void-surface px-3 py-2 overflow-x-auto">{newKey}</code>
            <button onClick={() => { navigator.clipboard.writeText(newKey); }} className="p-2 border border-void-border hover:bg-void-surface-2">
              <Copy size={14} className="text-void-muted" />
            </button>
          </div>
          <button onClick={() => setNewKey("")} className="text-xs text-void-muted hover:text-void-text">Dismiss</button>
        </div>
      )}

      {/* API Keys list */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-void-text">API Keys</h2>
            <p className="text-xs text-void-muted mt-0.5">Use API keys to authenticate programmatic access</p>
          </div>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-3 py-1.5 bg-void-accent text-void-bg text-xs font-medium hover:bg-void-accent-dim transition-colors">
            <Key size={12} /> Generate API Key
          </button>
        </div>

        {keys.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <Key size={32} className="text-void-muted mb-3" />
            <p className="text-void-muted text-sm">No API keys yet. <span className="text-void-accent cursor-pointer" onClick={() => setShowModal(true)}>Generate an API key</span> to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {keys.map((k) => (
              <div key={k.id} className="flex items-center justify-between p-3 bg-void-surface border border-void-border">
                <div>
                  <p className="text-sm text-void-text font-medium">{k.name}</p>
                  <p className="text-xs text-void-muted font-mono">{k.prefix}... · Created {new Date(k.createdAt).toLocaleDateString()}{k.lastUsed ? ` · Last used ${new Date(k.lastUsed).toLocaleDateString()}` : ""}</p>
                </div>
                <button onClick={() => deleteKey(k.id)} className="text-void-muted hover:text-void-danger transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* API Docs link */}
      <section>
        <h2 className="text-sm font-semibold text-void-text mb-2">API Documentation</h2>
        <a
          href="/api/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-void-accent hover:underline"
        >
          <ExternalLink size={14} />
          Open API reference docs
        </a>
      </section>

      {/* Create key modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm bg-void-surface border border-void-border p-6">
            <h3 className="text-base font-semibold text-void-text mb-4">Generate API Key</h3>
            <form onSubmit={createKey} className="space-y-4">
              <div>
                <label className="block text-sm text-void-muted mb-1">Key name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="e.g. CLI access, CI/CD"
                  className="w-full px-3 py-2 bg-void-bg border border-void-border text-void-text text-sm focus:outline-none focus:border-void-accent"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-void-muted border border-void-border hover:bg-void-surface-2">Cancel</button>
                <button type="submit" disabled={loading} className="px-4 py-2 bg-void-accent text-void-bg text-sm font-medium hover:bg-void-accent-dim disabled:opacity-50">
                  {loading ? "Generating..." : "Generate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
