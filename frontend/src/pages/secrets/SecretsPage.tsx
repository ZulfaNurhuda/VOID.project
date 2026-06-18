import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Copy, Check } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { secretsApi } from "@/lib/api";
import {
  decryptPrivateKey,
  decryptSymKey,
  decryptValue,
  encryptValue,
} from "@/lib/crypto";
import { useAuthStore } from "@/store/auth";
import { useErrorStore } from "@/store/errorStore";
import type { Secret } from "@/lib/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── DecryptCopyButton ─────────────────────────────────────────────────────────

interface DecryptCopyButtonProps {
  onGetValue: () => Promise<string>;
}

function DecryptCopyButton({ onGetValue }: DecryptCopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const value = await onGetValue();
    if (value) {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded text-void-muted hover:text-void-text transition-colors duration-150"
      title="Copy decrypted value"
    >
      {copied
        ? <Check size={14} className="text-void-success" />
        : <Copy size={14} />
      }
    </button>
  );
}

// ── SecretsPage ───────────────────────────────────────────────────────────────

interface SecretsPageProps {
  appId: string;
  envId: string;
}

export function SecretsPage({ appId, envId }: SecretsPageProps) {
  const queryClient = useQueryClient();
  const privateKeyEncrypted = useAuthStore((s) => s.privateKeyEncrypted);

  // Unlock state
  const [password, setPassword] = useState("");
  const [symKey, setSymKey] = useState<Uint8Array | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Secret | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["secrets", appId, envId],
    queryFn: () => secretsApi.list(appId, envId),
    enabled: !!appId && !!envId,
  });

  const unlock = async () => {
    if (!privateKeyEncrypted || !data) return;
    setUnlocking(true);
    try {
      const privKey = await decryptPrivateKey(password, privateKeyEncrypted);
      const sk = await decryptSymKey(data.encrypted_team_symmetric_key, privKey);
      setSymKey(sk);
    } catch {
      useErrorStore.getState().addError("Wrong password — could not decrypt keys");
    } finally {
      setUnlocking(false);
    }
  };

  const getDecryptedValue = async (secret: Secret): Promise<string> => {
    if (!symKey) return "";
    try {
      return await decryptValue(symKey, secret.encrypted_value);
    } catch {
      return "[decryption failed]";
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!symKey) throw new Error("Not unlocked");
      const encrypted = await encryptValue(symKey, newValue);
      await secretsApi.create(appId, envId, newKey, encrypted);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["secrets", appId, envId] });
      setCreateOpen(false);
      setNewKey("");
      setNewValue("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (secretId: string) =>
      secretsApi.delete(appId, envId, secretId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["secrets", appId, envId] });
      setDeleteTarget(null);
    },
  });

  const secrets = data?.secrets ?? [];

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-void-text text-xl font-semibold tracking-tight">
          Secrets
        </h1>
        <div className="flex items-center gap-2">
          {!symKey ? (
            <>
              <Input
                type="password"
                placeholder="Password to unlock"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && unlock()}
                className="bg-void-surface border-void-border text-void-text placeholder:text-void-dim w-56"
              />
              <Button
                onClick={unlock}
                disabled={unlocking || !password || !data}
                className="bg-void-accent hover:bg-void-accent-dim text-white border-0 text-[13px]"
              >
                {unlocking ? "Unlocking..." : "Unlock"}
              </Button>
            </>
          ) : (
            <>
              <span className="text-void-success text-[13px]">Unlocked</span>
              <Button
                onClick={() => setCreateOpen(true)}
                className="bg-void-accent hover:bg-void-accent-dim text-white border-0 text-[13px] gap-1.5"
              >
                <Plus size={14} />
                New secret
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-void-muted text-sm py-8 text-center">Loading...</div>
      ) : secrets.length === 0 ? (
        <EmptyState
          title="No secrets yet"
          description="Unlock with your password to create secrets."
        />
      ) : (
        <div className="border border-void-border rounded overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-void-surface border-b border-void-border">
                {["Key", "Value", "Created by", "Updated"].map((h) => (
                  <th
                    key={h}
                    className="text-left px-3 py-2.5 text-void-muted font-medium text-xs uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {secrets.map((secret) => (
                <tr
                  key={secret.id}
                  className="border-b border-void-border last:border-0 hover:bg-void-surface transition-colors"
                >
                  <td className="px-3 py-2.5 font-mono text-void-accent text-xs">
                    {secret.key}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-void-dim font-mono text-xs tracking-widest">
                        ••••••••
                      </span>
                      {symKey && (
                        <DecryptCopyButton
                          onGetValue={() => getDecryptedValue(secret)}
                        />
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-void-muted">
                    {secret.created_by_name ?? secret.created_by.slice(0, 8)}
                  </td>
                  <td className="px-3 py-2.5 text-void-muted">
                    {timeAgo(secret.updated_at)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => setDeleteTarget(secret)}
                        className="p-1 text-void-muted hover:text-void-danger transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-void-surface border border-void-border w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-void-text">New secret</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-2">
            <Input
              placeholder="KEY (e.g. DATABASE_URL)"
              value={newKey}
              onChange={(e) =>
                setNewKey(e.target.value.toUpperCase().replace(/\s+/g, "_"))
              }
              className="bg-void-bg border-void-border text-void-text placeholder:text-void-dim font-mono"
            />
            <Input
              placeholder="Value"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="bg-void-bg border-void-border text-void-text placeholder:text-void-dim font-mono"
            />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setCreateOpen(false);
                setNewKey("");
                setNewValue("");
              }}
              className="border-void-border-2 text-void-text bg-transparent hover:bg-void-surface-2 text-[13px]"
            >
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!newKey || !newValue || createMutation.isPending}
              className="bg-void-accent hover:bg-void-accent-dim text-white border-0 text-[13px]"
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete "${deleteTarget?.key}"?`}
        description="This cannot be undone. The secret and its history will be permanently deleted."
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMutation.isPending}
      />
    </>
  );
}
