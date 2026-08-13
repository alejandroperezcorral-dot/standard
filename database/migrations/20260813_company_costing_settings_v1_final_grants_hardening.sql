-- STDTEX Company Costing Settings V1
-- Final table grant hardening.
--
-- Contract:
-- - authenticated browser users may SELECT costing tables through RLS.
-- - all table writes must go through controlled RPC commands.
-- - anon and PUBLIC receive no direct table privileges.

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

revoke all privileges on table
  public.cost_models,
  public.company_costing_settings,
  public.cost_config_versions,
  public.cost_config_overrides,
  public.cost_additional_components
from anon;

revoke all privileges on table
  public.cost_models,
  public.company_costing_settings,
  public.cost_config_versions,
  public.cost_config_overrides,
  public.cost_additional_components
from public;
