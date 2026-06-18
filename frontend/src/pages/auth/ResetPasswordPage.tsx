import { useState } from "react";
import api from "../../lib/api";
import { useErrorStore } from "@/store/errorStore";


export default function ResetPasswordPage() {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      useErrorStore.getState().addError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, newPassword: password });
      setDone(true);
      setTimeout(() => {
        window.location.href = "/login";
      }, 2000);
    } catch {
      // axios interceptor handles API errors
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-void-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-void-text mb-1">Reset password</h1>
        <p className="text-void-muted mb-6">Enter your new password.</p>
        {done ? (
          <div className="p-4 border border-void-success/30 bg-void-success/10 text-void-success">
            Password reset successful. Redirecting to login…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="New password"
              className="w-full px-4 py-3 bg-void-surface border border-void-border text-void-text focus:outline-none focus:border-void-accent focus:ring-2 focus:ring-void-accent/30 transition-colors"
            />
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              placeholder="Confirm new password"
              className="w-full px-4 py-3 bg-void-surface border border-void-border text-void-text focus:outline-none focus:border-void-accent focus:ring-2 focus:ring-void-accent/30 transition-colors"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-void-accent text-void-bg font-medium hover:bg-void-accent-dim disabled:opacity-50 transition-colors"
            >
              {loading ? "Resetting..." : "Reset password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
