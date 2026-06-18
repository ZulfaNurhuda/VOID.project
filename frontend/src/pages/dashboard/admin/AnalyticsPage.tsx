// frontend/src/pages/dashboard/admin/AnalyticsPage.tsx
import { BarChart3 } from "lucide-react";
import { useEffect, useState } from "react";
import api from "../../../lib/api";

type Period = "7d" | "14d" | "30d";

interface Summary {
  totalSecrets: number;
  totalUsers: number;
  totalTeams: number;
  totalAccesses: number;
  personalSecrets: number;
  teamSecrets: number;
  topTeams: { id: string; name: string; count: number }[];
  topUsers: { id: string; name: string; count: number }[];
}

interface ActivityDay {
  date: string;
  secretsCreated: number;
  secretsAccessed: number;
}

function MetricCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="p-4 bg-void-surface border border-void-border">
      <p className="text-xs text-void-muted mb-1">{label}</p>
      <p className="text-2xl font-bold text-void-text">{value}</p>
      {sub && <p className="text-xs text-void-muted mt-1">{sub}</p>}
    </div>
  );
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>("7d");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [activity, setActivity] = useState<ActivityDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/admin/analytics/summary?period=${period}`),
      api.get(`/admin/analytics/activity?period=${period}`),
    ]).then(([s, a]) => {
      setSummary(s.data);
      setActivity(a.data.activity ?? []);
    }).finally(() => setLoading(false));
  }, [period]);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-void-text">Analytics</h1>
          <p className="text-void-muted mt-1">Platform usage overview</p>
        </div>
        <div className="flex gap-1">
          {(["7d", "14d", "30d"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-medium border transition-colors ${
                period === p
                  ? "border-void-accent bg-void-accent/10 text-void-accent"
                  : "border-void-border text-void-muted hover:text-void-text hover:bg-void-surface-2"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin border-2 border-void-accent border-t-transparent rounded-full" />
        </div>
      ) : summary ? (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MetricCard label="Total Secrets"    value={summary.totalSecrets} />
            <MetricCard label="Total Users"      value={summary.totalUsers} />
            <MetricCard label="Total Teams"      value={summary.totalTeams} />
            <MetricCard label="Secret Accesses"  value={summary.totalAccesses} sub={`last ${period}`} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <MetricCard label="Personal Secrets" value={summary.personalSecrets} />
            <MetricCard label="Team Secrets"     value={summary.teamSecrets} />
          </div>

          <div className="p-4 bg-void-surface border border-void-border">
            <p className="text-sm font-medium text-void-text mb-4">Daily Activity</p>
            <div className="flex items-end gap-1 h-24">
              {activity.map((day) => {
                const maxVal = Math.max(...activity.map((d) => d.secretsCreated + d.secretsAccessed), 1);
                const h = ((day.secretsCreated + day.secretsAccessed) / maxVal) * 100;
                return (
                  <div key={day.date} className="flex-1 flex flex-col gap-0.5" title={day.date}>
                    <div
                      className="bg-void-accent/60 hover:bg-void-accent transition-colors"
                      style={{ height: `${h}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-void-muted mt-1">
              <span>{activity[0]?.date?.slice(5)}</span>
              <span>{activity[activity.length - 1]?.date?.slice(5)}</span>
            </div>
          </div>

          {summary.topTeams.length > 0 && (
            <div className="p-4 bg-void-surface border border-void-border">
              <p className="text-sm font-medium text-void-text mb-3">Most Active Teams</p>
              <div className="space-y-2">
                {summary.topTeams.map((t) => (
                  <div key={t.id} className="flex items-center justify-between">
                    <span className="text-sm text-void-text">{t.name}</span>
                    <span className="text-xs text-void-muted">{t.count} secrets</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {summary.topUsers.length > 0 && (
            <div className="p-4 bg-void-surface border border-void-border">
              <p className="text-sm font-medium text-void-text mb-3">Most Active Users</p>
              <div className="space-y-2">
                {summary.topUsers.map((u) => (
                  <div key={u.id} className="flex items-center justify-between">
                    <span className="text-sm text-void-text">{u.name}</span>
                    <span className="text-xs text-void-muted">{u.count} events</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center py-20 text-center">
          <BarChart3 size={32} className="text-void-muted mb-3" />
          <p className="text-void-muted text-sm">No analytics data yet. Start using VOID to see metrics here.</p>
        </div>
      )}
    </div>
  );
}
