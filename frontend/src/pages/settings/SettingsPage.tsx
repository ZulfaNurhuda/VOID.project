import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth";

type Tab = "profile" | "security";

export function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<Tab>("profile");
  const [username, setUsername] = useState(user?.username ?? "");
  const [email, setEmail] = useState(user?.email ?? "");

  return (
    <>
      <div className="mb-6">
        <h1 className="text-void-text text-xl font-semibold tracking-tight">
          Settings
        </h1>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 mb-6 border-b border-void-border">
        {(["profile", "security"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-[13px] capitalize transition-colors -mb-px ${
              tab === t
                ? "text-void-text border-b-2 border-void-accent"
                : "text-void-muted hover:text-void-text"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <div className="max-w-sm flex flex-col gap-4">
          <div>
            <label className="text-void-muted text-xs uppercase tracking-wider block mb-1.5">
              Username
            </label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-void-surface border-void-border text-void-text"
            />
          </div>
          <div>
            <label className="text-void-muted text-xs uppercase tracking-wider block mb-1.5">
              Email
            </label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-void-surface border-void-border text-void-text"
            />
          </div>
          <Button className="bg-void-accent hover:bg-void-accent-dim text-white border-0 w-fit">
            Save changes
          </Button>
        </div>
      )}

      {tab === "security" && (
        <div className="max-w-sm flex flex-col gap-4">
          <div>
            <label className="text-void-muted text-xs uppercase tracking-wider block mb-1.5">
              Current password
            </label>
            <Input
              type="password"
              className="bg-void-surface border-void-border text-void-text"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="text-void-muted text-xs uppercase tracking-wider block mb-1.5">
              New password
            </label>
            <Input
              type="password"
              className="bg-void-surface border-void-border text-void-text"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="text-void-muted text-xs uppercase tracking-wider block mb-1.5">
              Confirm new password
            </label>
            <Input
              type="password"
              className="bg-void-surface border-void-border text-void-text"
              autoComplete="new-password"
            />
          </div>
          <Button className="bg-void-accent hover:bg-void-accent-dim text-white border-0 w-fit">
            Update password
          </Button>
        </div>
      )}
    </>
  );
}
