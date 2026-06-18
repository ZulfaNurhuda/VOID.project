// frontend/src/pages/dashboard/account/SecurityTab.tsx
import { Shield, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuthStore } from "../../../store/auth";
import api from "../../../lib/api";
import { useErrorStore } from "@/store/errorStore";

interface Session {
  id: string;
  deviceInfo?: string;
  ipAddress?: string;
  lastUsedAt: string;
  expiresAt: string;
}

export default function SecurityTab() {
  const { user, setAuth } = useAuthStore();
  // Password section
  const [curPw, setCurPw]         = useState("");
  const [newPw, setNewPw]         = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg]         = useState("");

  // 2FA section
  const [totpEnabled, setTotpEnabled] = useState(user?.totpEnabled ?? false);
  const [qrUri, setQrUri]           = useState("");
  const [totpSecret, setTotpSecret] = useState(""); // raw secret for manual entry fallback
  const [totpCode, setTotpCode]     = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [tfaLoading, setTfaLoading] = useState(false);

  // Sessions section
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    api.get("/auth/sessions").then((r) => setSessions(r.data.sessions ?? []));
  }, []);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) { useErrorStore.getState().addError("Passwords do not match"); return; }
    setPwLoading(true);
    setPwMsg("");
    try {
      await api.post("/user/change-password", { currentPassword: curPw, newPassword: newPw });
      setPwMsg("Password updated");
      setCurPw(""); setNewPw(""); setConfirmPw("");
    } catch {
      // axios interceptor handles API errors
    } finally {
      setPwLoading(false);
    }
  };

  const setup2FA = async () => {
    setTfaLoading(true);
    try {
      const r = await api.post("/auth/2fa/setup");
      setQrUri(r.data.qrUri);
      setTotpSecret(r.data.secret ?? "");
    } catch {
      // axios interceptor handles API errors
    } finally { setTfaLoading(false); }
  };

  const confirm2FA = async () => {
    setTfaLoading(true);
    try {
      const r = await api.post("/auth/2fa/verify", { code: totpCode });
      setBackupCodes(r.data.backupCodes);
      setTotpEnabled(true);
      setAuth({ ...user!, totpEnabled: true });
      setQrUri("");
    } catch {
      // axios interceptor handles API errors
    } finally { setTfaLoading(false); }
  };

  const disable2FA = async () => {
    const code = prompt("Enter your 2FA code to disable:");
    if (!code) return;
    try {
      await api.post("/auth/2fa/disable", { code });
      setTotpEnabled(false);
      setAuth({ ...user!, totpEnabled: false });
    } catch (err: any) {
      alert(err.response?.data?.error ?? "Failed");
    }
  };

  const revokeSession = async (id: string) => {
    await api.delete(`/auth/sessions/${id}`);
    setSessions((s) => s.filter((x) => x.id !== id));
  };

  const revokeOthers = async () => {
    await api.delete("/auth/sessions");
    const r = await api.get("/auth/sessions");
    setSessions(r.data.sessions ?? []);
  };

  return (
    <div className="space-y-10">
      {/* Change password */}
      <section>
        <h2 className="text-sm font-semibold text-void-text mb-4">Change password</h2>
        <form onSubmit={changePassword} className="space-y-3">
          {[
            { label: "Current password", value: curPw, set: setCurPw },
            { label: "New password",     value: newPw, set: setNewPw },
            { label: "Confirm new password", value: confirmPw, set: setConfirmPw },
          ].map(({ label, value, set }) => (
            <div key={label}>
              <label className="block text-sm text-void-muted mb-1">{label}</label>
              <input
                type="password"
                value={value}
                onChange={(e) => set(e.target.value)}
                required
                className="w-full px-3 py-2 bg-void-surface border border-void-border text-void-text text-sm focus:outline-none focus:border-void-accent"
              />
            </div>
          ))}
          {pwMsg && <p className={`text-xs ${pwMsg.includes("updated") ? "text-void-success" : "text-void-danger"}`}>{pwMsg}</p>}
          <button type="submit" disabled={pwLoading} className="px-4 py-2 bg-void-accent text-void-bg text-sm font-medium hover:bg-void-accent-dim disabled:opacity-50 transition-colors">
            {pwLoading ? "Updating..." : "Update password"}
          </button>
        </form>
      </section>

      {/* 2FA */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-void-text">Two-factor authentication</h2>
            <p className="text-xs text-void-muted mt-0.5">
              {totpEnabled ? "2FA is enabled" : "Add an extra layer of security"}
            </p>
          </div>
          {totpEnabled
            ? <div className="flex items-center gap-1.5 text-void-success text-xs"><ShieldCheck size={14} /> Enabled</div>
            : <div className="flex items-center gap-1.5 text-void-muted text-xs"><Shield size={14} /> Disabled</div>
          }
        </div>

        {!totpEnabled && !qrUri && (
          <button onClick={setup2FA} disabled={tfaLoading} className="px-4 py-2 border border-void-border text-void-text text-sm hover:bg-void-surface-2 transition-colors">
            Set up 2FA
          </button>
        )}

        {qrUri && (
          <div className="space-y-4 p-4 border border-void-border bg-void-surface">
            <p className="text-sm text-void-text">Scan this QR code with your authenticator app:</p>
            <div className="flex justify-center p-4 bg-white">
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrUri)}`} alt="2FA QR" className="w-44 h-44" />
            </div>
            {totpSecret && (
              <div>
                <p className="text-xs text-void-muted mb-1">Or enter this key manually in your app:</p>
                <code className="block text-xs font-mono text-void-text bg-void-bg px-2 py-1.5 tracking-wider break-all">{totpSecret}</code>
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="Enter 6-digit code"
                maxLength={6}
                className="flex-1 px-3 py-2 bg-void-bg border border-void-border text-void-text text-sm font-mono tracking-widest focus:outline-none focus:border-void-accent"
              />
              <button
                onClick={confirm2FA}
                disabled={totpCode.length !== 6 || tfaLoading}
                className="px-4 py-2 bg-void-accent text-void-bg text-sm font-medium hover:bg-void-accent-dim disabled:opacity-50"
              >
                Confirm
              </button>
            </div>
          </div>
        )}

        {totpEnabled && !qrUri && (
          <button onClick={disable2FA} className="px-4 py-2 border border-void-danger/30 text-void-danger text-sm hover:bg-void-danger/10 transition-colors">
            Disable 2FA
          </button>
        )}

        {backupCodes.length > 0 && (
          <div className="mt-4 p-4 border border-void-success/30 bg-void-success/5">
            <p className="text-sm text-void-text font-medium mb-2">Save your backup codes</p>
            <p className="text-xs text-void-muted mb-3">Store these securely. Each code can be used once.</p>
            <div className="grid grid-cols-2 gap-1">
              {backupCodes.map((code) => (
                <code key={code} className="text-xs font-mono text-void-success bg-void-surface px-2 py-1">{code}</code>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Sessions */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-void-text">Active sessions</h2>
          {sessions.length > 1 && (
            <button onClick={revokeOthers} className="text-xs text-void-accent hover:underline">
              Revoke all others
            </button>
          )}
        </div>
        <div className="space-y-2">
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between p-3 bg-void-surface border border-void-border">
              <div>
                <p className="text-sm text-void-text">{s.deviceInfo ?? "Unknown device"}</p>
                <p className="text-xs text-void-muted">{s.ipAddress ?? "Unknown IP"} · Last used {new Date(s.lastUsedAt).toLocaleDateString()}</p>
              </div>
              <button onClick={() => revokeSession(s.id)} className="text-void-muted hover:text-void-danger transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {sessions.length === 0 && <p className="text-xs text-void-muted">No active sessions</p>}
        </div>
      </section>
    </div>
  );
}
