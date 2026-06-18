// frontend/src/pages/dashboard/admin/UsersPage.tsx
import { Edit2, Plus, Trash2, Users2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "../../../store/auth";
import api from "../../../lib/api";
import {
  generateKeyPair,
  encryptPrivateKey,
  generateSymmetricKey,
  encryptSymKeyForRecipient,
  toBase64,
} from "../../../lib/crypto";

interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: "user" | "admin";
  status: "active" | "banned";
  createdAt: string;
}

interface EditForm {
  username: string;
  email: string;
  role: string;
  banned: boolean;
}

export default function UsersPage() {
  const currentUser = useAuthStore((s) => s.user);
  const [users, setUsers]       = useState<AdminUser[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading]   = useState(true);

  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ username: "", email: "", role: "user", banned: false });
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [addOpen, setAddOpen]   = useState(false);
  const [addForm, setAddForm]   = useState({ username: "", email: "", password: "", role: "user" });
  const [modalLoading, setModalLoading] = useState(false);

  const limit = 20;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    api.get(`/admin/users?page=${page}&limit=${limit}&search=${debouncedSearch}`)
      .then((r) => { setUsers(r.data.users); setTotal(r.data.total); })
      .finally(() => setLoading(false));
  }, [page, debouncedSearch]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const openEdit = (u: AdminUser) => {
    setEditUser(u);
    setEditForm({ username: u.username, email: u.email, role: u.role, banned: u.status === "banned" });
  };

  const saveEdit = async () => {
    if (!editUser) return;
    setModalLoading(true);
    try {
      await api.patch(`/admin/users/${editUser.id}`, editForm);
      setEditUser(null); fetchUsers();
    } catch {
      // axios interceptor handles API errors
    } finally { setModalLoading(false); }
  };

  const confirmDelete = async () => {
    if (!deleteUser || deleteConfirm !== deleteUser.username) return;
    setModalLoading(true);
    try {
      await api.delete(`/admin/users/${deleteUser.id}`);
      setDeleteUser(null); setDeleteConfirm(""); fetchUsers();
    } finally { setModalLoading(false); }
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault(); setModalLoading(true);
    try {
      const { publicKey, privateKey } = await generateKeyPair();
      const privateKeyEncrypted = await encryptPrivateKey(addForm.password, privateKey);
      const workspaceSymKey = await generateSymmetricKey();
      const encryptedWorkspaceSymKey = await encryptSymKeyForRecipient(publicKey, workspaceSymKey);
      await api.post("/admin/users", {
        ...addForm,
        public_key: toBase64(publicKey),
        private_key_encrypted: privateKeyEncrypted,
        encrypted_workspace_sym_key: encryptedWorkspaceSymKey,
      });
      setAddOpen(false); setAddForm({ username: "", email: "", password: "", role: "user" }); fetchUsers();
    } catch {
      // axios interceptor handles API errors
    } finally { setModalLoading(false); }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-void-text">Users</h1>
          <p className="text-void-muted mt-1">Manage platform users</p>
        </div>
        <button onClick={() => { setAddOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-void-accent text-void-bg text-sm font-medium hover:bg-void-accent-dim transition-colors">
          <Plus size={14} /> Add user
        </button>
      </div>

      <div className="mb-4">
        <input type="text" value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by username or email..."
          className="w-full max-w-sm px-3 py-2 bg-void-surface border border-void-border text-void-text text-sm focus:outline-none focus:border-void-accent" />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-6 w-6 animate-spin border-2 border-void-accent border-t-transparent rounded-full" />
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <Users2 size={32} className="text-void-muted mb-3" />
          <p className="text-void-muted text-sm">No users found. <span className="text-void-accent cursor-pointer" onClick={() => setAddOpen(true)}>Add a user</span> to get started.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-void-border text-xs text-void-muted text-left">
                  <th className="pb-3 pr-4 font-medium">User</th>
                  <th className="pb-3 pr-4 font-medium">Role</th>
                  <th className="pb-3 pr-4 font-medium">Status</th>
                  <th className="pb-3 pr-4 font-medium">Joined</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isMe = u.id === currentUser?.id;
                  const initials = u.username.slice(0, 2).toUpperCase();
                  return (
                    <tr key={u.id} className="border-b border-void-border/50 hover:bg-void-surface/50">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-7 w-7 items-center justify-center bg-void-accent/20 text-void-accent text-xs font-semibold shrink-0">{initials}</div>
                          <div>
                            <p className="text-void-text font-medium">{u.username}</p>
                            <p className="text-xs text-void-muted">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${u.role === "admin" ? "bg-void-accent/10 text-void-accent" : "bg-void-surface-2 text-void-muted"}`}>{u.role}</span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${u.status === "banned" ? "bg-void-danger/10 text-void-danger" : "bg-void-success/10 text-void-success"}`}>{u.status}</span>
                      </td>
                      <td className="py-3 pr-4 text-void-muted text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEdit(u)} disabled={isMe} className="text-void-muted hover:text-void-text disabled:opacity-30 transition-colors" title="Edit"><Edit2 size={14} /></button>
                          <button onClick={() => { setDeleteUser(u); setDeleteConfirm(""); }} disabled={isMe} className="text-void-muted hover:text-void-danger disabled:opacity-30 transition-colors" title="Delete"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-void-muted">{total} users total</p>
              <div className="flex gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button key={p} onClick={() => setPage(p)}
                    className={`px-3 py-1 text-xs border transition-colors ${page === p ? "border-void-accent bg-void-accent/10 text-void-accent" : "border-void-border text-void-muted hover:bg-void-surface-2"}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Edit modal */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm bg-void-surface border border-void-border p-6">
            <h3 className="text-base font-semibold text-void-text mb-4">Edit User</h3>
            <div className="space-y-3">
              {([["Username","username","text"],["Email","email","email"]] as const).map(([label, key, type]) => (
                <div key={key}>
                  <label className="block text-xs text-void-muted mb-1">{label}</label>
                  <input type={type} value={editForm[key as keyof EditForm] as string}
                    onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full px-3 py-2 bg-void-bg border border-void-border text-void-text text-sm focus:outline-none focus:border-void-accent" />
                </div>
              ))}
              <div>
                <label className="block text-xs text-void-muted mb-1">Role</label>
                <select value={editForm.role} onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                  className="w-full px-3 py-2 bg-void-bg border border-void-border text-void-text text-sm focus:outline-none focus:border-void-accent">
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editForm.banned} onChange={(e) => setEditForm((f) => ({ ...f, banned: e.target.checked }))} className="accent-void-danger" />
                <span className="text-sm text-void-text">Banned</span>
              </label>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button onClick={() => setEditUser(null)} className="px-4 py-2 text-sm text-void-muted border border-void-border hover:bg-void-surface-2">Cancel</button>
              <button onClick={saveEdit} disabled={modalLoading} className="px-4 py-2 bg-void-accent text-void-bg text-sm font-medium hover:bg-void-accent-dim disabled:opacity-50">
                {modalLoading ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {deleteUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm bg-void-surface border border-void-border p-6">
            <h3 className="text-base font-semibold text-void-danger mb-2">Delete User</h3>
            <p className="text-sm text-void-muted mb-4">Type <span className="font-mono text-void-text">{deleteUser.username}</span> to confirm.</p>
            <input type="text" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)}
              className="w-full px-3 py-2 bg-void-bg border border-void-danger/30 text-void-text text-sm focus:outline-none focus:border-void-danger mb-4" placeholder="Type username to confirm" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteUser(null)} className="px-4 py-2 text-sm text-void-muted border border-void-border hover:bg-void-surface-2">Cancel</button>
              <button onClick={confirmDelete} disabled={deleteConfirm !== deleteUser.username || modalLoading}
                className="px-4 py-2 bg-void-danger text-void-bg text-sm font-medium hover:opacity-80 disabled:opacity-50">
                {modalLoading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add user modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm bg-void-surface border border-void-border p-6">
            <h3 className="text-base font-semibold text-void-text mb-4">Add User</h3>
            <form onSubmit={createUser} className="space-y-3">
              {([["Username","username","text"],["Email","email","email"],["Password","password","password"]] as const).map(([label, key, type]) => (
                <div key={key}>
                  <label className="block text-xs text-void-muted mb-1">{label}</label>
                  <input type={type} value={addForm[key]} onChange={(e) => setAddForm((f) => ({ ...f, [key]: e.target.value }))} required
                    className="w-full px-3 py-2 bg-void-bg border border-void-border text-void-text text-sm focus:outline-none focus:border-void-accent" />
                </div>
              ))}
              <div>
                <label className="block text-xs text-void-muted mb-1">Role</label>
                <select value={addForm.role} onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value }))}
                  className="w-full px-3 py-2 bg-void-bg border border-void-border text-void-text text-sm focus:outline-none focus:border-void-accent">
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setAddOpen(false)} className="px-4 py-2 text-sm text-void-muted border border-void-border hover:bg-void-surface-2">Cancel</button>
                <button type="submit" disabled={modalLoading} className="px-4 py-2 bg-void-accent text-void-bg text-sm font-medium hover:bg-void-accent-dim disabled:opacity-50">
                  {modalLoading ? "Creating..." : "Create user"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
