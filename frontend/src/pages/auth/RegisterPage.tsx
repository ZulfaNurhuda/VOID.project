import { useState } from "react";
import { ArrowLeft, User, Mail, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useErrorStore } from "@/store/errorStore";
import {
  generateKeyPair,
  generateSymmetricKey,
  encryptSymKeyForRecipient,
  encryptPrivateKey,
  toBase64,
} from "@/lib/crypto";

export function RegisterPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      useErrorStore.getState().addError("Passphrase must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      useErrorStore.getState().addError("Passphrases do not match");
      return;
    }
    setLoading(true);
    try {
      const { publicKey, privateKey } = await generateKeyPair();
      const workspaceSymKey = await generateSymmetricKey();
      const encryptedWorkspaceSymKey = await encryptSymKeyForRecipient(publicKey, workspaceSymKey);
      const encryptedPrivateKey = await encryptPrivateKey(password, privateKey);

      const res = await authApi.register({
        username,
        email,
        password,
        publicKey: toBase64(publicKey),
        privateKeyEncrypted: encryptedPrivateKey,
        workspaceSymKeyEncrypted: encryptedWorkspaceSymKey,
      });

      useAuthStore.getState().setAuth((res as any).user);
      window.location.href = "/dashboard/secrets";
    } catch {
      // error pushed to ErrorDisplay by axios interceptor
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <a
          href="/login"
          className="inline-flex items-center gap-2 text-void-muted hover:text-void-accent transition-colors mb-8 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-200" />
          Back to sign in
        </a>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-void-text tracking-tight">Create account</h1>
          <p className="text-void-muted mt-1">Your keys are generated locally</p>
        </div>

        <div className="bg-void-surface border border-void-border p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-void-muted">Username</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-void-dim">
                  <User className="w-4 h-4" />
                </div>
                <Input
                  placeholder="Choose a username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-9"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-void-muted">Email</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-void-dim">
                  <Mail className="w-4 h-4" />
                </div>
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-void-muted">Passphrase</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-void-dim">
                  <Lock className="w-4 h-4" />
                </div>
                <Input
                  type="password"
                  placeholder="Create a passphrase (min 8 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-void-muted">Confirm Passphrase</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-void-dim">
                  <Lock className="w-4 h-4" />
                </div>
                <Input
                  type="password"
                  placeholder="Confirm your passphrase"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="pl-9"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || !username || !email || !password || !confirm}
              className="w-full bg-void-accent hover:bg-void-accent-dim text-void-bg font-medium border-0"
            >
              {loading ? "Creating account..." : "Create account"}
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-void-border text-center">
            <p className="text-void-muted">
              Have an account?{" "}
              <a href="/login" className="text-void-accent hover:text-void-accent-dim font-medium transition-colors">
                Sign In
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
