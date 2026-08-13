-- STAGING SECURITY PATCH
-- COSTING SETTINGS V1
-- AUTHENTICATED TABLE PRIVILEGES
-- REVIEWED FOR STAGING
--
-- This patch corrects the already-migrated staging database so authenticated
-- browser users have direct SELECT only on the Costing V1 tables.

revoke all privileges on table
  public.cost_models,
  public.company_costing_settings,
  public.cost_config_versions,
  public.cost_config_overrides,
  public.cost_additional_components
from authenticated;

grant select on table
  public.cost_models,
  public.company_costing_settings,
  public.cost_config_versions,
  public.cost_config_overrides,
  public.cost_additional_components
to authenticated;
