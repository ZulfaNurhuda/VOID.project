import axios from "axios";
import type {
  AuthResponse, User, Team, TeamMember, App,
  Environment, SecretsListResponse, SecretHistoryEntry, AuditLog,
} from "./types";
import { useErrorStore } from "@/store/errorStore";

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';
const http = axios.create({ baseURL: API_BASE, withCredentials: true });

const AUTH_PATHS = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-2fa", "/setup"];

function extractErrorMessage(data: unknown): string {
  if (!data || typeof data !== "object") return "An unexpected error occurred";
  const d = data as Record<string, unknown>;
  if (typeof d.error === "string") return d.error;
  if (typeof d.message === "string") return d.message;
  return "An unexpected error occurred";
}

// Global response interceptor — pushes BE errors to ErrorDisplay
http.interceptors.response.use(
  (r) => r,
  (error) => {
    const status = error.response?.status;

    if (status === 401 && !AUTH_PATHS.some((p) => window.location.pathname.startsWith(p))) {
      window.location.href = "/login";
      return Promise.reject(error);
    }

    if (error.response?.data) {
      const msg = extractErrorMessage(error.response.data);
      useErrorStore.getState().addError(msg);
    } else if (error.message) {
      useErrorStore.getState().addError(error.message);
    }

    return Promise.reject(error);
  }
);

// ── Auth ────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (body: {
    username: string;
    email: string;
    password: string;
    publicKey: string;
    privateKeyEncrypted: string;
    workspaceSymKeyEncrypted: string;
    inviteCode?: string;
  }) => http.post<AuthResponse>("/auth/register", body).then((r) => r.data),

  login: (username: string, password: string) =>
    http
      .post<AuthResponse>("/auth/login", { username, password }, { withCredentials: true })
      .then((r) => r.data),

  logout: () => http.post("/auth/logout", {}, { withCredentials: true }),

  me: () => http.get<User>("/auth/me").then((r) => r.data),

  getUserByUsername: (username: string) =>
    http
      .get<{ id: string; public_key: string }>(
        `/auth/users?username=${encodeURIComponent(username)}`
      )
      .then((r) => r.data),
};

// ── Teams ────────────────────────────────────────────────────────────────────
export const teamsApi = {
  list: () => http.get<Team[]>("/teams").then((r) => r.data),

  create: (name: string, encrypted_team_symmetric_key: string) =>
    http.post<{ id: string }>("/teams", { name, encrypted_team_symmetric_key }).then((r) => r.data),

  get: (teamId: string) => http.get<Team>(`/teams/${teamId}`).then((r) => r.data),

  update: (teamId: string, name: string) =>
    http.put(`/teams/${teamId}`, { name }),

  delete: (teamId: string) => http.delete(`/teams/${teamId}`),

  listMembers: (teamId: string) =>
    http.get<TeamMember[]>(`/teams/${teamId}/members`).then((r) => r.data),

  addMember: (teamId: string, username: string, encrypted_team_symmetric_key: string) =>
    http.post(`/teams/${teamId}/members`, { username, encrypted_team_symmetric_key }),

  removeMember: (teamId: string, userId: string) =>
    http.delete(`/teams/${teamId}/members/${userId}`),

  updateRole: (teamId: string, userId: string, role: string) =>
    http.put(`/teams/${teamId}/members/${userId}/role`, { role }),
};

// ── Apps ─────────────────────────────────────────────────────────────────────
export const appsApi = {
  list: (workspaceType?: string, workspaceId?: string) => {
    const params =
      workspaceType && workspaceId
        ? `?workspace_type=${workspaceType}&workspace_id=${workspaceId}`
        : "";
    return http.get<App[]>(`/apps${params}`).then((r) => r.data);
  },

  create: (body: {
    name: string;
    description?: string;
    workspace_id: string;
    workspace_type: string;
  }) => http.post<{ id: string }>("/apps", body).then((r) => r.data),

  get: (appId: string) => http.get<App>(`/apps/${appId}`).then((r) => r.data),

  update: (appId: string, name: string, description: string) =>
    http.put(`/apps/${appId}`, { name, description }),

  delete: (appId: string) => http.delete(`/apps/${appId}`),
};

// ── Environments ─────────────────────────────────────────────────────────────
export const envsApi = {
  list: (appId: string) =>
    http.get<Environment[]>(`/apps/${appId}/envs`).then((r) => r.data),

  create: (appId: string, name: string) =>
    http.post<{ id: string }>(`/apps/${appId}/envs`, { name }).then((r) => r.data),

  update: (appId: string, envId: string, name: string) =>
    http.put(`/apps/${appId}/envs/${envId}`, { name }),

  delete: (appId: string, envId: string) =>
    http.delete(`/apps/${appId}/envs/${envId}`),
};

// ── Secrets ──────────────────────────────────────────────────────────────────
export const secretsApi = {
  list: (appId: string, envId: string) =>
    http
      .get<SecretsListResponse>(`/apps/${appId}/envs/${envId}/secrets`)
      .then((r) => r.data),

  create: (appId: string, envId: string, key: string, encrypted_value: string) =>
    http.post(`/apps/${appId}/envs/${envId}/secrets`, { key, encrypted_value }),

  update: (appId: string, envId: string, secretId: string, encrypted_value: string) =>
    http.put(`/apps/${appId}/envs/${envId}/secrets/${secretId}`, { encrypted_value }),

  delete: (appId: string, envId: string, secretId: string) =>
    http.delete(`/apps/${appId}/envs/${envId}/secrets/${secretId}`),

  import: (
    appId: string,
    envId: string,
    secrets: { key: string; encrypted_value: string }[]
  ) => http.post(`/apps/${appId}/envs/${envId}/secrets/import`, { secrets }),

  history: (appId: string, envId: string, secretId: string) =>
    http
      .get<SecretHistoryEntry[]>(
        `/apps/${appId}/envs/${envId}/secrets/${secretId}/history`
      )
      .then((r) => r.data),
};

// ── Audit ─────────────────────────────────────────────────────────────────────
export const auditApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return http
      .get<{ logs: AuditLog[]; page: number; limit: number }>(`/audit-logs${qs}`)
      .then((r) => r.data);
  },
};

// ── Session ────────────────────────────────────────────────────────────────────
export async function fetchSession(): Promise<User | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/session`, { credentials: "include" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user ?? null;
  } catch {
    return null;
  }
}

export default http;
