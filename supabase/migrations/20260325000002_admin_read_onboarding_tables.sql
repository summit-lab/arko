-- Admin read policies for onboarding tables
-- Without these, the admin panel cannot view client ADN progress

CREATE POLICY "admin_select_workspace_profile" ON workspace_profile FOR SELECT USING (is_admin());
CREATE POLICY "admin_select_workspace_strategies" ON workspace_strategies FOR SELECT USING (is_admin());
CREATE POLICY "admin_select_workspace_market" ON workspace_market FOR SELECT USING (is_admin());
CREATE POLICY "admin_select_workspace_competitors" ON workspace_competitors FOR SELECT USING (is_admin());
CREATE POLICY "admin_select_workspace_brand" ON workspace_brand FOR SELECT USING (is_admin());
CREATE POLICY "admin_select_workspace_references" ON workspace_references FOR SELECT USING (is_admin());
