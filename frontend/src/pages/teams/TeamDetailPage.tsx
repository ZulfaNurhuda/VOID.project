import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserMinus, ArrowLeft } from "lucide-react";
import { AppAccordion } from "@/components/shared/AppAccordion";
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
import { teamsApi, authApi } from "@/lib/api";
import {
  decryptPrivateKey,
  decryptSymKey,
  encryptSymKeyForRecipient,
  fromBase64,
} from "@/lib/crypto";
import { useAuthStore } from "@/store/auth";
import { useErrorStore } from "@/store/errorStore";

interface TeamDetailPageProps {
  teamId: string;
}

type Tab = "members" | "apps";

export function TeamDetailPage({ teamId }: TeamDetailPageProps) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const privateKeyEncrypted = useAuthStore((s) => s.privateKeyEncrypted);

  const [tab, setTab] = useState<Tab>("members");

  // Members state
  const [addOpen, setAddOpen] = useState(false);
  const [addUsername, setAddUsername] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);

  const { data: team } = useQuery({
    queryKey: ["team", teamId],
    queryFn: () => teamsApi.get(teamId),
  });

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ["team-members", teamId],
    queryFn: () => teamsApi.listMembers(teamId),
  });

  // Derive RBAC
  const isOwner = team?.owner_id === user?.id;
  const myMember = members.find((m) => m.user_id === user?.id);
  const canManage = isOwner || myMember?.role === "admin";

  const addMutation = useMutation({
    onError: (err: Error) => useErrorStore.getState().addError(err.message),
    mutationFn: async () => {
      if (!privateKeyEncrypted) throw new Error("No private key");

      // Decrypt our private key
      const privKey = await decryptPrivateKey(addPassword, privateKeyEncrypted);

      // Find our own encrypted_team_symmetric_key
      const ownMember = members.find((m) => m.user_id === user?.id);
      if (!ownMember?.encrypted_team_symmetric_key) {
        throw new Error("Cannot find your team key");
      }

      // Decrypt team sym key with our private key
      const symKey = await decryptSymKey(
        ownMember.encrypted_team_symmetric_key,
        privKey
      );

      // Get target user's public key by username
      const targetUser = await authApi.getUserByUsername(addUsername);
      const targetPubKey = fromBase64(targetUser.public_key);

      // Re-encrypt sym key for the new member
      const encSymKey = await encryptSymKeyForRecipient(targetPubKey, symKey);

      await teamsApi.addMember(teamId, addUsername, encSymKey);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members", teamId] });
      setAddOpen(false);
      setAddUsername("");
      setAddPassword("");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => teamsApi.removeMember(teamId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members", teamId] });
      setRemoveTarget(null);
    },
  });

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <a
          href="/dashboard/teams"
          className="text-void-muted hover:text-void-text transition-colors"
        >
          <ArrowLeft size={16} />
        </a>
        <h1 className="text-void-text text-xl font-semibold tracking-tight">
          {team?.name ?? "Team"}
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-void-border">
        {(["members", "apps"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-[13px] capitalize transition-colors ${
              tab === t
                ? "text-void-text border-b-2 border-void-accent -mb-px"
                : "text-void-muted hover:text-void-text"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Members Tab ── */}
      {tab === "members" && (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-void-muted text-xs uppercase tracking-wider font-medium">
              Members
            </h2>
            {canManage && (
              <Button
                onClick={() => setAddOpen(true)}
                className="bg-void-accent hover:bg-void-accent-dim text-white border-0 text-[13px]"
              >
                Add member
              </Button>
            )}
          </div>

          {membersLoading ? (
            <div className="text-void-muted text-sm py-8 text-center">
              Loading...
            </div>
          ) : members.length === 0 ? (
            <EmptyState title="No members yet" />
          ) : (
            <div className="border border-void-border rounded overflow-hidden">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-void-surface border-b border-void-border">
                    {["Name", "Email", "Role", ""].map((h, i) => (
                      <th
                        key={i}
                        className="text-left px-3 py-2.5 text-void-muted font-medium text-xs uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => {
                    const isMemberOwner = team?.owner_id === m.user_id;
                    return (
                      <tr
                        key={m.id}
                        className="border-b border-void-border last:border-0 hover:bg-void-surface transition-colors"
                      >
                        <td className="px-3 py-2.5 text-void-text">
                          {m.username}
                        </td>
                        <td className="px-3 py-2.5 text-void-muted">
                          {m.email}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium uppercase tracking-wide ${
                              isMemberOwner
                                ? "bg-[#2d1f1f] text-orange-400"
                                : m.role === "admin"
                                ? "bg-[#1a3547] text-void-accent"
                                : "bg-[#1e2a1e] text-void-success"
                            }`}
                          >
                            {isMemberOwner ? "owner" : m.role}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          {canManage &&
                            !isMemberOwner &&
                            m.user_id !== user?.id && (
                              <button
                                onClick={() => setRemoveTarget(m.user_id)}
                                className="p-1 text-void-muted hover:text-void-danger transition-colors"
                                title="Remove member"
                              >
                                <UserMinus size={14} />
                              </button>
                            )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Add Member Modal */}
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogContent className="bg-void-surface border border-void-border w-96">
              <DialogHeader>
                <DialogTitle className="text-void-text">
                  Add member
                </DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3 mt-2">
                <Input
                  placeholder="Username"
                  value={addUsername}
                  onChange={(e) => setAddUsername(e.target.value)}
                  className="bg-void-bg border-void-border text-void-text placeholder:text-void-dim"
                />
                <Input
                  type="password"
                  placeholder="Your password (to re-encrypt team key)"
                  value={addPassword}
                  onChange={(e) => setAddPassword(e.target.value)}
                  className="bg-void-bg border-void-border text-void-text placeholder:text-void-dim"
                />
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setAddOpen(false);
                    setAddUsername("");
                    setAddPassword("");
                  }}
                  className="border-void-border-2 text-void-text bg-transparent hover:bg-void-surface-2 text-[13px]"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => addMutation.mutate()}
                  disabled={
                    !addUsername || !addPassword || addMutation.isPending
                  }
                  className="bg-void-accent hover:bg-void-accent-dim text-white border-0 text-[13px]"
                >
                  {addMutation.isPending ? "Adding..." : "Add"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Remove Confirm */}
          <ConfirmDialog
            open={!!removeTarget}
            title="Remove member?"
            description="They will immediately lose access to all team secrets."
            confirmLabel="Remove"
            onConfirm={() =>
              removeTarget && removeMutation.mutate(removeTarget)
            }
            onCancel={() => setRemoveTarget(null)}
            loading={removeMutation.isPending}
          />
        </>
      )}

      {/* ── Apps Tab ── */}
      {tab === "apps" && (
        <AppAccordion
          workspaceId={teamId}
          workspaceType="team"
          canManage={canManage}
        />
      )}
    </>
  );
}
