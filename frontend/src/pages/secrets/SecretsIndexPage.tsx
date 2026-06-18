import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Key, Layers } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { EmptyState } from "@/components/shared/EmptyState";
import { appsApi, envsApi } from "@/lib/api";
import type { App, Environment } from "@/lib/types";

/** One app card showing its environments — read-only, navigation only */
function AppCard({ app }: { app: App }) {
  const { data: envs = [] } = useQuery({
    queryKey: ["envs", app.id],
    queryFn: () => envsApi.list(app.id),
  });

  return (
    <div className="border border-void-border rounded overflow-hidden">
      {/* App header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-void-surface border-b border-void-border">
        <Layers size={14} className="text-void-muted flex-shrink-0" />
        <span className="text-void-text text-[13px] font-medium truncate">
          {app.name}
        </span>
        <span className="ml-auto text-void-dim text-xs capitalize">
          {app.workspace_type}
        </span>
      </div>

      {/* Environments */}
      {envs.length === 0 ? (
        <div className="px-4 py-3 text-void-dim text-xs">
          No environments yet
        </div>
      ) : (
        (envs as Environment[]).map((env) => (
          <a
            key={env.id}
            href={`/dashboard/apps/${app.id}/envs/${env.id}/secrets`}
            className="flex items-center justify-between px-4 py-2.5 hover:bg-void-surface transition-colors border-b border-void-border last:border-0 group"
          >
            <div className="flex items-center gap-2">
              <Key size={12} className="text-void-dim" />
              <span className="text-void-muted group-hover:text-void-text text-[13px] transition-colors">
                {env.name}
              </span>
            </div>
            <ChevronRight size={14} className="text-void-dim group-hover:text-void-muted transition-colors" />
          </a>
        ))
      )}
    </div>
  );
}

export function SecretsIndexPage() {
  const { data: apps = [], isLoading } = useQuery({
    queryKey: ["apps"],
    queryFn: () => appsApi.list(),
  });

  return (
    <>
      <div className="mb-6">
        <h1 className="text-void-text text-xl font-semibold tracking-tight">
          Secrets
        </h1>
        <p className="text-void-muted text-sm mt-1">
          Select an environment to view and manage its secrets.
        </p>
      </div>

      {isLoading ? (
        <div className="text-void-muted text-sm py-8 text-center">
          Loading...
        </div>
      ) : apps.length === 0 ? (
        <EmptyState
          title="No apps yet"
          description="Create a personal app or add one through your team."
          action={
            <div className="flex gap-4">
              <Link
                to="/dashboard/personal"
                className="text-void-accent hover:text-void-accent-dim text-[13px] transition-colors"
              >
                Personal →
              </Link>
              <Link
                to="/dashboard/teams"
                className="text-void-accent hover:text-void-accent-dim text-[13px] transition-colors"
              >
                Teams →
              </Link>
            </div>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {(apps as App[]).map((app) => (
            <AppCard key={app.id} app={app} />
          ))}
        </div>
      )}
    </>
  );
}
