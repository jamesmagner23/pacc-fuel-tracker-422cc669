
ALTER TABLE public.auth_activity_log
ADD CONSTRAINT valid_action CHECK (
  action IN ('login', 'logout', 'password_changed', 'settings_updated', 'role_changed', 'user_created', 'user_deleted', 'sync_triggered', 'export', 'fuel_intake', 'page_view')
);
