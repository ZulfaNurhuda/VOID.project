import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "../../../store/auth";
import api from "../../../lib/api";

export default function DangerZoneTab() {
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();
  const [confirmUsername, setConfirmUsername] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.delete("/user/account", { data: { username: confirmUsername } });
      clearAuth();
      navigate({ to: "/login" });
    } catch {
      // axios interceptor handles API errors
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-4 border border-void-danger/30 bg-void-danger/5">
        <div className="flex items-start gap-3">
          <AlertTriangle size={16} className="text-void-danger mt-0.5 shrink-0" />
          <div>
            <h2 className="text-sm font-semibold text-void-danger mb-1">Delete account</h2>
            <p className="text-xs text-void-muted mb-4">
              This will permanently delete your account, all personal secrets, and remove you from all teams.
              This action cannot be undone.
            </p>
            <form onSubmit={handleDelete} className="space-y-3">
              <div>
                <label className="block text-xs text-void-muted mb-1">
                  Type <span className="font-mono text-void-text">{user?.username}</span> to confirm
                </label>
                <input
                  type="text"
                  value={confirmUsername}
                  onChange={(e) => setConfirmUsername(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-void-bg border border-void-danger/30 text-void-text text-sm focus:outline-none focus:border-void-danger"
                />
              </div>
              <button
                type="submit"
                disabled={loading || confirmUsername !== user?.username}
                className="px-4 py-2 bg-void-danger text-void-bg text-sm font-medium hover:opacity-80 disabled:opacity-50 transition-opacity"
              >
                {loading ? "Deleting..." : "Delete my account"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
