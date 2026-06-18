// frontend/src/pages/dashboard/admin/instance/InstancePage.tsx
import { AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import api from "../../../../lib/api";
import GeneralTab      from "./GeneralTab";
import SecurityTab     from "./SecurityTab";
import OrganizationTab from "./OrganizationTab";
import WebhookTab      from "./WebhookTab";
import MetricsTab      from "./MetricsTab";

const tabs = [
  { id: "general",      label: "General" },
  { id: "security",     label: "Security" },
  { id: "organization", label: "Organization" },
  { id: "webhook",      label: "Webhook" },
  { id: "metrics",      label: "Metrics" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export interface InstanceSettings {
  general:      Record<string, unknown>;
  security:     Record<string, unknown>;
  organization: Record<string, unknown>;
  webhook:      Record<string, unknown>;
  metrics:      Record<string, unknown>;
  isManaged:    boolean;
}

export default function InstancePage() {
  const [tab, setTab]           = useState<TabId>("general");
  const [settings, setSettings] = useState<InstanceSettings | null>(null);
  const [loading, setLoading]   = useState(true);

  const refetch = () => {
    setLoading(true);
    api.get("/admin/instance").then((r) => setSettings(r.data)).finally(() => setLoading(false));
  };
  useEffect(refetch, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-void-text">Instance</h1>
          <p className="text-void-muted mt-1">Configure your VOID instance</p>
        </div>
      </div>

      {settings?.isManaged && (
        <div className="flex items-center gap-3 p-4 mb-6 border border-void-warning/30 bg-void-warning/5 text-void-warning text-sm">
          <AlertCircle size={16} />
          This instance is managed — settings are controlled externally and cannot be modified here.
        </div>
      )}

      <div className="flex gap-1 border-b border-void-border mb-8">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.id ? "border-void-accent text-void-accent" : "border-transparent text-void-muted hover:text-void-text"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-6 w-6 animate-spin border-2 border-void-accent border-t-transparent rounded-full" />
        </div>
      ) : settings ? (
        <div className="max-w-2xl">
          {tab === "general"      && <GeneralTab      settings={settings} refetch={refetch} />}
          {tab === "security"     && <SecurityTab     settings={settings} refetch={refetch} />}
          {tab === "organization" && <OrganizationTab settings={settings} refetch={refetch} />}
          {tab === "webhook"      && <WebhookTab      settings={settings} refetch={refetch} />}
          {tab === "metrics"      && <MetricsTab      settings={settings} refetch={refetch} />}
        </div>
      ) : null}
    </div>
  );
}
