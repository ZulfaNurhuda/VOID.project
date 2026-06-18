export interface User {
  id: string;
  username: string;
  email: string;
  role?: "admin" | "member";
  public_key: string;
  private_key_encrypted?: string;
  personal_workspace_id?: string;
  totpEnabled?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Team {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  username: string;
  email: string;
  role: "admin" | "member";
  encrypted_team_symmetric_key?: string;
  created_at: string;
}

export interface App {
  id: string;
  name: string;
  description: string;
  workspace_id: string;
  workspace_type: "team" | "personal";
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Environment {
  id: string;
  app_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Secret {
  id: string;
  environment_id: string;
  key: string;
  encrypted_value: string;
  created_by: string;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface SecretsListResponse {
  encrypted_team_symmetric_key: string;
  secrets: Secret[];
}

export interface SecretHistoryEntry {
  id: string;
  secret_id: string | null;
  old_encrypted_value: string | null;
  new_encrypted_value: string | null;
  changed_by: string;
  changed_by_name: string;
  action: "created" | "updated" | "deleted";
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string;
  actor_name: string;
  workspace_id: string;
  workspace_type: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}
