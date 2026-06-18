import { useState } from "react";
import { User, Mail, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { useErrorStore } from "@/store/errorStore";
import {
  generateKeyPair,
  generateSymmetricKey,
  encryptSymKeyForRecipient,
  encryptPrivateKey,
  toBase64,
} from "@/lib/crypto";

export function SetupPage() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

      await api.post("/auth/setup", {
        name,
        username,
        email,
        password,
        publicKey: toBase64(publicKey),
        privateKeyEncrypted: encryptedPrivateKey,
        workspaceSymKeyEncrypted: encryptedWorkspaceSymKey,
      });

      window.location.href = "/login";
    } catch {
      // error already pushed to ErrorDisplay by axios interceptor
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-void-text tracking-tight">Welcome to VOID</h1>
          <p className="text-void-muted mt-1">Create the first admin account to get started.</p>
        </div>

        <div className="bg-void-surface border border-void-border p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-void-muted">Full Name</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-void-dim"><User className="w-4 h-4" /></div>
                <Input placeholder="Enter your full name" value={name} onChange={(e) => setName(e.target.value)} className="pl-9" autoComplete="name" required />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-void-muted">Username</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-void-dim"><User className="w-4 h-4" /></div>
                <Input placeholder="Choose a username" value={username} onChange={(e) => setUsername(e.target.value)} className="pl-9" autoComplete="username" required />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-void-muted">Email Address</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-void-dim"><Mail className="w-4 h-4" /></div>
                <Input type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9" autoComplete="email" required />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-void-muted">Passphrase</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-void-dim"><Lock className="w-4 h-4" /></div>
                <Input type="password" placeholder="Create a passphrase (min 8 characters)" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9" autoComplete="new-password" required minLength={8} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-void-muted">Confirm Passphrase</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-void-dim"><Lock className="w-4 h-4" /></div>
                <Input type="password" placeholder="Confirm your passphrase" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="pl-9" autoComplete="new-password" required minLength={8} />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-void-accent hover:bg-void-accent-dim text-void-bg font-medium border-0 mt-1"
            >
              {loading ? "Creating admin account..." : "Create Admin Account"}
            </Button>
          </form>

          <p className="text-xs text-void-muted text-center mt-6">
            This setup can only be completed once. The admin account will have full access to manage this instance.
          </p>
        </div>
      </div>
    </div>
  );
}
