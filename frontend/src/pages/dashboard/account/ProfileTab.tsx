// frontend/src/pages/dashboard/account/ProfileTab.tsx
import { useState } from "react";
import { useAuthStore } from "../../../store/auth";
import api from "../../../lib/api";

export default function ProfileTab() {
  const { user, setAuth } = useAuthStore();
  const [username, setUsername] = useState(user?.username ?? "");
  const [email, setEmail]       = useState(user?.email ?? "");
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);

  const initials = username.slice(0, 2).toUpperCase();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    try {
      await api.patch("/user/profile", { username, email });
      setAuth({ ...user!, username, email });
      setSuccess(true);
    } catch {
      // axios interceptor handles API errors
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center bg-void-accent/20 text-void-accent font-bold text-xl">
          {initials}
        </div>
        <div>
          <p className="text-sm text-void-text font-medium">{username}</p>
          <p className="text-xs text-void-muted">Avatar uses your initials</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-sm text-void-muted mb-1">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 bg-void-surface border border-void-border text-void-text text-sm focus:outline-none focus:border-void-accent"
          />
        </div>
        <div>
          <label className="block text-sm text-void-muted mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 bg-void-surface border border-void-border text-void-text text-sm focus:outline-none focus:border-void-accent"
          />
        </div>

        {success && <p className="text-void-success text-xs">Profile updated</p>}

        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-void-accent text-void-bg text-sm font-medium hover:bg-void-accent-dim disabled:opacity-50 transition-colors"
        >
          {loading ? "Saving..." : "Save changes"}
        </button>
      </form>
    </div>
  );
}
