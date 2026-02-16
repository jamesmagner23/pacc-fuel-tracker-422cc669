import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function PortalNotifications() {
  const { user } = useAuth();
  const [settings, setSettings] = useState({
    weekly_summary_email: false,
    monthly_summary_email: true,
    delivery_notification: false,
  });
  const [settingsId, setSettingsId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const loadSettings = async () => {
      // Get client account id
      const { data: account } = await supabase
        .from("client_accounts")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();

      if (!account) {
        setLoading(false);
        return;
      }

      const { data: existing } = await supabase
        .from("client_portal_settings")
        .select("*")
        .eq("client_account_id", account.id)
        .single();

      if (existing) {
        setSettingsId(existing.id);
        setSettings({
          weekly_summary_email: existing.weekly_summary_email ?? false,
          monthly_summary_email: existing.monthly_summary_email ?? true,
          delivery_notification: existing.delivery_notification ?? false,
        });
      } else {
        // Create default settings
        const { data: created } = await supabase
          .from("client_portal_settings")
          .insert({ client_account_id: account.id })
          .select()
          .single();
        if (created) setSettingsId(created.id);
      }
      setLoading(false);
    };

    loadSettings();
  }, [user]);

  const toggleSetting = async (key: keyof typeof settings) => {
    if (!settingsId) return;
    const newVal = !settings[key];
    setSettings((prev) => ({ ...prev, [key]: newVal }));

    const { error } = await supabase
      .from("client_portal_settings")
      .update({ [key]: newVal })
      .eq("id", settingsId);

    if (error) toast.error("Failed to save setting");
    else toast.success("Setting updated");
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;

  const toggles = [
    { key: "weekly_summary_email" as const, label: "Weekly Summary Email", desc: "Receive a weekly summary of your fuel usage." },
    { key: "monthly_summary_email" as const, label: "Monthly Summary Email", desc: "Receive a monthly summary report." },
    { key: "delivery_notification" as const, label: "Delivery Notifications", desc: "Get notified when a delivery is made." },
  ];

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-xl font-bold">Notification Settings</h1>
      <div className="space-y-3">
        {toggles.map((t) => (
          <div key={t.key} className="glass-card p-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">{t.label}</div>
              <div className="text-xs text-muted-foreground">{t.desc}</div>
            </div>
            <button
              onClick={() => toggleSetting(t.key)}
              className={`relative w-11 h-6 rounded-full transition-colors ${settings[t.key] ? "bg-primary" : "bg-secondary"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-foreground rounded-full transition-transform ${settings[t.key] ? "translate-x-5" : ""}`} />
            </button>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Email notifications coming soon. Settings are saved for when they become available.</p>
    </div>
  );
}
