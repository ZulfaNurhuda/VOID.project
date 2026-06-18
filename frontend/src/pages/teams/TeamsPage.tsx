import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Users } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { teamsApi } from "@/lib/api";
import {
  generateSymmetricKey,
  encryptSymKeyForRecipient,
  decryptPrivateKey as validatePassword,
  fromBase64,
} from "@/lib/crypto";
import { useAuthStore } from "@/store/auth";
import { useErrorStore } from "@/store/errorStore";

export function TeamsPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const privateKeyEncrypted = useAuthStore((s) => s.privateKeyEncrypted);

  const [createOpen, setCreateOpen] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [password, setPassword] = useState("");

  const { data: teams = [], isLoading } = useQuery({
    queryKey: ["teams"],
    queryFn: teamsApi.list,
  });

  const createMutation = useMutation({
    onError: (err: Error) => useErrorStore.getState().addError(err.message),
    mutationFn: async () => {
      if (!user || !privateKeyEncrypted) throw new Error("Not authenticated");
      if (!user.public_key) throw new Error("Account has no public key");
      // Validate password by decrypting — if wrong, this throws before any key material is generated
      await validatePassword(password, privateKeyEncrypted);
      const symKey = await generateSymmetricKey();
      const pubKeyBytes = fromBase64(user.public_key);
      const encSymKey = await encryptSymKeyForRecipient(pubKeyBytes, symKey);
      return teamsApi.create(teamName, encSymKey);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      setCreateOpen(false);
      setTeamName("");
      setPassword("");
    },
  });

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-void-text text-xl font-semibold tracking-tight">
          Teams
        </h1>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-void-accent hover:bg-void-accent-dim text-white border-0 text-[13px] gap-1.5"
        >
          <Plus size={14} />
          New team
        </Button>
      </div>

      {isLoading ? (
        <div className="text-void-muted text-sm py-8 text-center">Loading...</div>
      ) : teams.length === 0 ? (
        <EmptyState
          title="No teams"
          description="Create your first team to collaborate with others."
        />
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {teams.map((team) => (
            <a
              key={team.id}
              href={`/dashboard/teams/${team.id}`}
              className="bg-void-surface border border-void-border rounded p-4 hover:bg-void-surface-2 transition-colors block"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Users size={15} className="text-void-muted flex-shrink-0" />
                <span className="text-void-text text-[13px] font-medium truncate">
                  {team.name}
                </span>
              </div>
              <p className="text-void-dim text-xs">
                {team.owner_id === user?.id ? "Owner" : "Member"}
              </p>
            </a>
          ))}
        </div>
      )}

      {/* Create Team Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-void-surface border border-void-border w-96">
          <DialogHeader>
            <DialogTitle className="text-void-text">New team</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-2">
            <Input
              placeholder="Team name"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="bg-void-bg border-void-border text-void-text placeholder:text-void-dim"
            />
            <Input
              type="password"
              placeholder="Your password (to encrypt team key)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-void-bg border-void-border text-void-text placeholder:text-void-dim"
            />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setCreateOpen(false);
                setTeamName("");
                setPassword("");
              }}
              className="border-void-border-2 text-void-text bg-transparent hover:bg-void-surface-2 text-[13px]"
            >
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!teamName || !password || createMutation.isPending}
              className="bg-void-accent hover:bg-void-accent-dim text-white border-0 text-[13px]"
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
