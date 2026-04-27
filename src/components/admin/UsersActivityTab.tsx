import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, subDays } from "date-fns";
import { Users, Activity, Trash2, Pencil, LogIn, Download, Eye, X } from "lucide-react";
import { toast } from "sonner";
import { useDemo } from "@/hooks/useDemo";
import { DEMO_USERS, DEMO_ACTIVITY } from "@/data/demoData";

interface UserRow {
  id: string;
  user_id: string;
  role: string;
  full_name: string | null;
  email: string | null;
  client_account_id: number | null;
  company_name?: string | null;
}

interface ActivityRow {
  id: string;
  user_id: string;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
  full_name?: string;
  email?: string;
}

function useAdminUsers() {
  const isDemo = useDemo();
  return useQuery({
    queryKey: ["admin-users", isDemo],
    queryFn: async () => {
      if (isDemo) return DEMO_USERS as UserRow[];
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("id, user_id, role, full_name, email, client_account_id")
        .order("role").order("full_name");
      if (error) throw error;
      const clientIds = [...new Set((roles || []).filter(r => r.client_account_id).map(r => r.client_account_id))];
      let accountsMap: Record<number, string> = {};
      if (clientIds.length > 0) {
        const { data: accounts } = await supabase
          .from("client_accounts")
          .select("id, company_name")
          .in("id", clientIds);
        accountsMap = Object.fromEntries((accounts || []).map(a => [a.id, a.company_name]));
      }
      return (roles || []).map(r => ({
        ...r,
        company_name: r.client_account_id ? accountsMap[r.client_account_id] || null : null,
      })) as UserRow[];
    },
  });
}

function useActivityLogs(days = 30) {
  const isDemo = useDemo();
  return useQuery({
    queryKey: ["admin-activity", days, isDemo],
    queryFn: async () => {
      if (isDemo) return DEMO_ACTIVITY as ActivityRow[];
      const since = format(subDays(new Date(), days), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("auth_activity_log")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const userIds = [...new Set((data || []).map(d => d.user_id))];
      let nameMap: Record<string, { full_name: string; email: string }> = {};
      if (userIds.length > 0) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("user_id, full_name, email")
          .in("user_id", userIds);
        nameMap = Object.fromEntries((roles || []).map(r => [r.user_id, { full_name: r.full_name || "", email: r.email || "" }]));
      }
      return (data || []).map(d => ({
        ...d,
        full_name: nameMap[d.user_id]?.full_name || "Unknown",
        email: nameMap[d.user_id]?.email || "",
      })) as ActivityRow[];
    },
  });
}

function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("User role removed");
    },
    onError: () => toast.error("Failed to remove user"),
  });
}

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-primary/20 text-primary",
  client: "bg-blue-500/20 text-blue-400",
  driver: "bg-positive/20 text-positive",
};

const ACTION_ICONS: Record<string, typeof LogIn> = {
  login: LogIn,
  export: Download,
  page_view: Eye,
};

export default function UsersActivityTab() {
  const { data: users = [], isLoading: usersLoading } = useAdminUsers();
  const { data: activity = [], isLoading: activityLoading } = useActivityLogs();
  const deleteUser = useDeleteUser();
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const qc = useQueryClient();

  const admins = users.filter(u => u.role === "admin");
  const clients = users.filter(u => u.role === "client");
  const drivers = users.filter(u => u.role === "driver");

  const loginCount = activity.filter(a => a.action === "login").length;
  const exportCount = activity.filter(a => a.action === "export").length;
  const uniqueActiveUsers = new Set(activity.map(a => a.user_id)).size;

  const loginsByUser = activity
    .filter(a => a.action === "login")
    .reduce((acc, a) => {
      acc[a.full_name || a.email || a.user_id] = (acc[a.full_name || a.email || a.user_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  const handleEdit = (user: UserRow) => {
    setEditingUser(user);
    setEditName(user.full_name || "");
    setEditEmail(user.email || "");
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    const { error } = await supabase
      .from("user_roles")
      .update({ full_name: editName, email: editEmail })
      .eq("id", editingUser.id);
    if (error) { toast.error("Failed to update"); return; }
    toast.success("Updated");
    setEditingUser(null);
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Users", value: users.length, icon: <Users className="w-4 h-4" /> },
          { label: "Active (30d)", value: uniqueActiveUsers, icon: <Activity className="w-4 h-4" /> },
          { label: "Logins (30d)", value: loginCount, icon: <LogIn className="w-4 h-4" /> },
          { label: "Exports (30d)", value: exportCount, icon: <Download className="w-4 h-4" /> },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-surface border border-surface-border rounded-[10px] p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{kpi.label}</span>
              <span className="text-muted-foreground">{kpi.icon}</span>
            </div>
            <div className="text-2xl font-semibold text-foreground tabular-nums">{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">All Users ({users.length})</div>
          <div className="flex gap-2 text-[10px]">
            <span className="bg-primary/20 text-primary px-2 py-0.5 rounded-full">{admins.length} Admin</span>
            <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">{clients.length} Client</span>
            <span className="bg-positive/20 text-positive px-2 py-0.5 rounded-full">{drivers.length} Driver</span>
          </div>
        </div>
        {usersLoading ? (
          <div className="text-muted-foreground text-sm">Loading…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-[10px] text-muted-foreground uppercase tracking-wider py-2 pr-3 font-medium">Name</th>
                  <th className="text-[10px] text-muted-foreground uppercase tracking-wider py-2 pr-3 font-medium">Email</th>
                  <th className="text-[10px] text-muted-foreground uppercase tracking-wider py-2 pr-3 font-medium">Role</th>
                  <th className="text-[10px] text-muted-foreground uppercase tracking-wider py-2 pr-3 font-medium">Company</th>
                  <th className="text-[10px] text-muted-foreground uppercase tracking-wider py-2 font-medium w-20">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 pr-3 text-[13px] text-foreground font-medium">{user.full_name || "—"}</td>
                    <td className="py-2.5 pr-3 text-[13px] text-muted-foreground">{user.email || "—"}</td>
                    <td className="py-2.5 pr-3">
                      <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${ROLE_COLORS[user.role] || ""}`}>{user.role}</span>
                    </td>
                    <td className="py-2.5 pr-3 text-[13px] text-muted-foreground">{user.company_name || "—"}</td>
                    <td className="py-2.5">
                      <div className="flex gap-1">
                        <button onClick={() => handleEdit(user)} className="bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground p-1 transition-colors" title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {user.role !== "admin" && (
                          <button onClick={() => { if (confirm(`Remove ${user.full_name || user.email}?`)) deleteUser.mutate(user.user_id); }} className="bg-transparent border-none cursor-pointer text-muted-foreground hover:text-destructive p-1 transition-colors" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {Object.keys(loginsByUser).length > 0 && (
        <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3.5">Login Frequency (30 days)</div>
          <div className="flex flex-col gap-2">
            {Object.entries(loginsByUser).sort(([, a], [, b]) => b - a).map(([name, count]) => {
              const max = Math.max(...Object.values(loginsByUser));
              return (
                <div key={name} className="flex items-center gap-3">
                  <span className="text-[13px] text-foreground w-40 truncate">{name}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(count / max) * 100}%` }} />
                  </div>
                  <span className="text-[12px] text-muted-foreground tabular-nums w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-surface border border-surface-border rounded-[10px] p-4 sm:p-5">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3.5">
          Recent Activity ({activity.length} events — last 30 days)
        </div>
        {activityLoading ? (
          <div className="text-muted-foreground text-sm">Loading…</div>
        ) : activity.length === 0 ? (
          <div className="text-muted-foreground text-[13px]">No activity logged yet.</div>
        ) : (
          <div className="flex flex-col max-h-[400px] overflow-y-auto">
            {activity.map((a) => {
              const Icon = ACTION_ICONS[a.action] || Activity;
              return (
                <div key={a.id} className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-b-0">
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-foreground">
                      <span className="font-medium">{a.full_name || a.email}</span>
                      <span className="text-muted-foreground"> — {a.action.replace(/_/g, " ")}</span>
                    </div>
                    {a.metadata && Object.keys(a.metadata).length > 0 && (
                      <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{JSON.stringify(a.metadata).slice(0, 80)}</div>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground whitespace-nowrap">{format(parseISO(a.created_at), "dd MMM HH:mm")}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editingUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setEditingUser(null)}>
          <div className="bg-surface border border-surface-border rounded-[10px] p-5 w-full max-w-[400px]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Edit User</div>
              <button onClick={() => setEditingUser(null)} className="bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-muted-foreground">Full Name</label>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} className="bg-raised border border-surface-border rounded-lg text-foreground px-3 py-2 text-[13px] outline-none" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-muted-foreground">Email</label>
                <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="bg-raised border border-surface-border rounded-lg text-foreground px-3 py-2 text-[13px] outline-none" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-muted-foreground">Role</label>
                <div className={`text-[12px] font-semibold uppercase px-2 py-1 rounded-full w-fit ${ROLE_COLORS[editingUser.role]}`}>{editingUser.role}</div>
              </div>
              <button onClick={handleSaveEdit} className="bg-primary text-primary-foreground border-none rounded-full px-5 py-2 text-xs font-semibold cursor-pointer mt-2">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}