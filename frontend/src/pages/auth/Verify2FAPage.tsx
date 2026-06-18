import { Shield } from "lucide-react";
import { useRef, useState } from "react";
import api from "../../lib/api";
import { useAuthStore } from "../../store/auth";


export default function Verify2FAPage() {
  const tempToken = sessionStorage.getItem("void-2fa-temp") ?? "";
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post<{ user: any }>("/auth/2fa/check", {
        tempToken,
        code,
      });
      useAuthStore.getState().setAuth(res.data.user);
      sessionStorage.removeItem("void-2fa-temp");
      window.location.href = "/dashboard/secrets";
    } catch {
      // axios interceptor handles API errors
      setCode("");
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-void-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-void-accent/10">
            <Shield size={24} className="text-void-accent" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-void-text mb-1">Two-Factor Auth</h1>
        <p className="text-void-muted text-sm mb-6">
          Enter the 6-digit code from your authenticator app.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            ref={inputRef}
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            autoFocus
            required
            maxLength={6}
            placeholder="000000"
            className="w-full px-4 py-3 bg-void-surface border border-void-border text-void-text text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:border-void-accent"
          />
          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full py-2 bg-void-accent text-void-bg font-medium text-sm hover:bg-void-accent-dim disabled:opacity-50 transition-colors"
          >
            {loading ? "Verifying..." : "Verify"}
          </button>
        </form>
      </div>
    </div>
  );
}
