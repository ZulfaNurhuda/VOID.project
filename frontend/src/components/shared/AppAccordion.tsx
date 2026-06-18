import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  Key,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { appsApi, envsApi } from "@/lib/api";
import type { App, Environment } from "@/lib/types";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface AppAccordionProps {
  workspaceId: string;
  workspaceType: "team" | "personal";
  canManage: boolean;
}

// ── AppRow (internal) ─────────────────────────────────────────────────────────

interface AppRowProps {
  app: App;
  canManage: boolean;
  onDeleteApp: (appId: string, appName: string) => void;
}

function AppRow({ app, canManage, onDeleteApp }: AppRowProps) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [addEnvOpen, setAddEnvOpen] = useState(false);
  const [envName, setEnvName] = useState("");
  const [envError, setEnvError] = useState("");
  const [deleteEnvTarget, setDeleteEnvTarget] = useState<Environment | null>(null);

  const { data: envs = [], isLoading: envsLoading } = useQuery({
    queryKey: ["envs", app.id],
    queryFn: () => envsApi.list(app.id),
    enabled: expanded,
  });

  const createEnvMutation = useMutation({
    mutationFn: (name: string) => envsApi.create(app.id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["envs", app.id] });
      setAddEnvOpen(false);
      setEnvName("");
      setEnvError("");
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { error?: string } }; message?: string };
      setEnvError(axiosErr?.response?.data?.error ?? axiosErr?.message ?? "Failed to create environment");
    },
  });

  const deleteEnvMutation = useMutation({
    mutationFn: (envId: string) => envsApi.delete(app.id, envId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["envs", app.id] });
      setDeleteEnvTarget(null);
    },
  });

  return (
    <>
      <div className="border border-void-border rounded overflow-hidden mb-2">
        {/* App header row — click to expand */}
        <div
          className="flex items-center justify-between px-3 py-2.5 bg-void-surface cursor-pointer hover:bg-void-surface-2 transition-colors select-none"
          onClick={() => setExpanded((v) => !v)}
        >
          <div className="flex items-center gap-2 min-w-0">
            {expanded ? (
              <ChevronDown size={14} className="text-void-dim flex-shrink-0" />
            ) : (
              <ChevronRight size={14} className="text-void-dim flex-shrink-0" />
            )}
            <Layers size={14} className="text-void-muted flex-shrink-0" />
            <span className="text-void-text text-[13px] font-medium truncate">
              {app.name}
            </span>
            {app.description && (
              <span className="text-void-dim text-xs truncate hidden sm:block">
                {app.description}
              </span>
            )}
          </div>
          {/* Delete button — stopPropagation so it doesn't toggle expand */}
          {canManage && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteApp(app.id, app.name);
              }}
              className="p-1 ml-2 text-void-dim hover:text-void-danger transition-colors flex-shrink-0"
              title="Delete app"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>

        {/* Expanded: env list */}
        {expanded && (
          <div className="border-t border-void-border">
            {envsLoading ? (
              <div className="px-4 py-2.5 text-void-dim text-xs">
                Loading...
              </div>
            ) : envs.length === 0 ? (
              <div className="px-4 py-2.5 text-void-dim text-xs">
                No environments yet.
              </div>
            ) : (
              envs.map((env: Environment) => (
                <div
                  key={env.id}
                  className="flex items-center justify-between px-4 py-2 border-b border-void-border last:border-0 group hover:bg-void-surface transition-colors"
                >
                  <Link
                    to="/dashboard/apps/$appId/envs/$envId/secrets"
                    params={{ appId: app.id, envId: env.id }}
                    className="flex items-center gap-2 flex-1 min-w-0"
                  >
                    <Key size={12} className="text-void-dim flex-shrink-0" />
                    <span className="text-void-muted group-hover:text-void-text text-[13px] transition-colors">
                      {env.name}
                    </span>
                  </Link>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Link
                      to="/dashboard/apps/$appId/envs/$envId/secrets"
                      params={{ appId: app.id, envId: env.id }}
                      className="text-void-accent text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Open →
                    </Link>
                    {canManage && (
                      <button
                        onClick={() => setDeleteEnvTarget(env)}
                        className="p-1 text-void-dim hover:text-void-danger transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete environment"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}

            {/* Add env button */}
            {canManage && (
              <button
                onClick={() => setAddEnvOpen(true)}
                className="w-full flex items-center gap-1.5 px-4 py-2 text-void-dim hover:text-void-muted text-[12px] transition-colors border-t border-void-border"
              >
                <Plus size={12} />
                Add environment
              </button>
            )}
          </div>
        )}
      </div>

      {/* Add Env Modal */}
      <Dialog open={addEnvOpen} onOpenChange={setAddEnvOpen}>
        <DialogContent className="bg-void-surface border border-void-border w-80">
          <DialogHeader>
            <DialogTitle className="text-void-text text-[14px]">
              New environment — {app.name}
            </DialogTitle>
          </DialogHeader>
          <Input
            placeholder="e.g. dev, staging, prod"
            value={envName}
            onChange={(e) => setEnvName(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && envName && createEnvMutation.mutate(envName)
            }
            autoFocus
            className="bg-void-bg border-void-border text-void-text placeholder:text-void-dim"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setAddEnvOpen(false);
                setEnvName("");
                setEnvError("");
              }}
              className="border-void-border-2 text-void-text bg-transparent hover:bg-void-surface-2 text-[13px]"
            >
              Cancel
            </Button>
            {envError && <p className="text-void-danger text-xs">{envError}</p>}
            <Button
              onClick={() => createEnvMutation.mutate(envName)}
              disabled={!envName || createEnvMutation.isPending}
              className="bg-void-accent hover:bg-void-accent-dim text-white border-0 text-[13px]"
            >
              {createEnvMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Env Confirm */}
      <ConfirmDialog
        open={!!deleteEnvTarget}
        title={`Delete environment "${deleteEnvTarget?.name}"?`}
        description="This will permanently delete the environment and all its secrets."
        confirmLabel="Delete"
        onConfirm={() =>
          deleteEnvTarget && deleteEnvMutation.mutate(deleteEnvTarget.id)
        }
        onCancel={() => setDeleteEnvTarget(null)}
        loading={deleteEnvMutation.isPending}
      />
    </>
  );
}

// ── AppAccordion (exported) ───────────────────────────────────────────────────

export function AppAccordion({
  workspaceId,
  workspaceType,
  canManage,
}: AppAccordionProps) {
  const queryClient = useQueryClient();
  const [createAppOpen, setCreateAppOpen] = useState(false);
  const [appName, setAppName] = useState("");
  const [appDesc, setAppDesc] = useState("");
  const [appError, setAppError] = useState("");
  const [deleteAppTarget, setDeleteAppTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const { data: apps = [], isLoading } = useQuery({
    queryKey: ["apps", workspaceType, workspaceId],
    queryFn: () => appsApi.list(workspaceType, workspaceId),
    enabled: !!workspaceId,
  });

  const createAppMutation = useMutation({
    mutationFn: (vars: { name: string; description?: string }) =>
      appsApi.create({
        name: vars.name,
        description: vars.description,
        workspace_id: workspaceId,
        workspace_type: workspaceType,
      }),
    onSuccess: () => {
      // Broad invalidation: covers SecretsIndexPage (["apps"]) + this accordion
      queryClient.invalidateQueries({ queryKey: ["apps"] });
      setCreateAppOpen(false);
      setAppName("");
      setAppDesc("");
      setAppError("");
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { error?: string } }; message?: string };
      setAppError(axiosErr?.response?.data?.error ?? axiosErr?.message ?? "Failed to create app");
    },
  });

  const deleteAppMutation = useMutation({
    mutationFn: (appId: string) => appsApi.delete(appId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apps"] });
      setDeleteAppTarget(null);
    },
  });

  if (isLoading) {
    return (
      <div className="text-void-muted text-sm py-8 text-center">
        Loading...
      </div>
    );
  }

  return (
    <div>
      {/* New App button */}
      {canManage && (
        <div className="flex justify-end mb-3">
          <Button
            onClick={() => setCreateAppOpen(true)}
            className="bg-void-accent hover:bg-void-accent-dim text-white border-0 text-[13px] gap-1.5"
          >
            <Plus size={14} />
            New App
          </Button>
        </div>
      )}

      {/* App list */}
      {apps.length === 0 ? (
        <EmptyState
          title="No apps yet"
          description={
            canManage
              ? "Create your first app to start organizing secrets."
              : "No apps in this workspace."
          }
        />
      ) : (
        (apps as App[]).map((app) => (
          <AppRow
            key={app.id}
            app={app}
            canManage={canManage}
            onDeleteApp={(id, name) => setDeleteAppTarget({ id, name })}
          />
        ))
      )}

      {/* Create App Modal */}
      <Dialog open={createAppOpen} onOpenChange={setCreateAppOpen}>
        <DialogContent className="bg-void-surface border border-void-border w-96">
          <DialogHeader>
            <DialogTitle className="text-void-text text-[14px]">
              New app
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input
              placeholder="App name (e.g. api-service)"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              autoFocus
              className="bg-void-bg border-void-border text-void-text placeholder:text-void-dim"
            />
            <Input
              placeholder="Description (optional)"
              value={appDesc}
              onChange={(e) => setAppDesc(e.target.value)}
              className="bg-void-bg border-void-border text-void-text placeholder:text-void-dim"
            />
          </div>
          {appError && <p className="text-void-danger text-xs mt-1">{appError}</p>}
          <div className="flex justify-end gap-2 mt-2">
            <Button
              variant="outline"
              onClick={() => {
                setCreateAppOpen(false);
                setAppName("");
                setAppDesc("");
                setAppError("");
              }}
              className="border-void-border-2 text-void-text bg-transparent hover:bg-void-surface-2 text-[13px]"
            >
              Cancel
            </Button>
            <Button
              onClick={() => createAppMutation.mutate({ name: appName, description: appDesc || undefined })}
              disabled={!appName || createAppMutation.isPending}
              className="bg-void-accent hover:bg-void-accent-dim text-white border-0 text-[13px]"
            >
              {createAppMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete App Confirm */}
      <ConfirmDialog
        open={!!deleteAppTarget}
        title={`Delete app "${deleteAppTarget?.name}"?`}
        description="This will permanently delete the app and all its environments and secrets."
        confirmLabel="Delete"
        onConfirm={() =>
          deleteAppTarget && deleteAppMutation.mutate(deleteAppTarget.id)
        }
        onCancel={() => setDeleteAppTarget(null)}
        loading={deleteAppMutation.isPending}
      />
    </div>
  );
}
