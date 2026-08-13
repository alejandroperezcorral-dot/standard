-- STDTEX current production policy baseline
--
-- PURPOSE:
--   STDTEX staging/bootstrap reconstruction only.
--
-- SOURCE:
--   Read-only extraction from current production schema project ref
--   vtyffyywmqnlfemzlsbz.
--
-- DO NOT APPLY THIS FILE DIRECTLY TO EXISTING PRODUCTION.
--
-- This file represents the CURRENT PRE-ORG-SECURITY-V2 policy baseline.

create policy app_state_read on public.app_state as permissive for select to public
using (true);

create policy app_state_update_admin on public.app_state as permissive for update to public
using (((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text));

create policy app_state_write_admin on public.app_state as permissive for insert to public
with check (((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text));

create policy approvals_admin_or_self_read on public.approval_requests as permissive for select to public
using ((((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text) OR (user_id = auth.uid())));

create policy approvals_admin_write on public.approval_requests as permissive for all to public
using (((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text))
with check (((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text));

create policy audit_admin_insert on public.audit_logs as permissive for insert to public
with check (((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text));

create policy audit_admin_read on public.audit_logs as permissive for select to public
using (((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text));

create policy companies_admin_or_member_read on public.companies as permissive for select to public
using ((((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text) OR (EXISTS ( SELECT 1
   FROM company_memberships m
  WHERE ((m.company_id = companies.id) AND (m.user_id = auth.uid()) AND (m.membership_status = 'Approved'::text))))));

create policy companies_admin_write on public.companies as permissive for all to public
using (((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text))
with check (((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text));

create policy companies_authenticated_read on public.companies as permissive for select to authenticated
using (true);

create policy companies_company_admin_read_write on public.companies as permissive for all to authenticated
using ((((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text) OR (EXISTS ( SELECT 1
   FROM company_memberships cm
  WHERE ((cm.company_id = companies.id) AND (cm.user_id = auth.uid()) AND (cm.membership_status = 'Active'::text) AND (cm.access_role = ANY (ARRAY['Company Admin'::text, 'Platform Admin'::text])))))))
with check ((((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text) OR (EXISTS ( SELECT 1
   FROM company_memberships cm
  WHERE ((cm.company_id = companies.id) AND (cm.user_id = auth.uid()) AND (cm.membership_status = 'Active'::text) AND (cm.access_role = ANY (ARRAY['Company Admin'::text, 'Platform Admin'::text])))))));

create policy companies_company_member_read on public.companies as permissive for select to authenticated
using ((((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text) OR (EXISTS ( SELECT 1
   FROM company_memberships cm
  WHERE ((cm.company_id = companies.id) AND (cm.user_id = auth.uid()) AND (cm.membership_status = 'Active'::text))))));

create policy companies_owner_admin_write on public.companies as permissive for all to authenticated
using ((((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text) OR (created_by = ( SELECT auth.uid() AS uid))))
with check ((((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text) OR (created_by = ( SELECT auth.uid() AS uid))));

create policy company_group_memberships_admin_write on public.company_group_memberships as permissive for all to authenticated
using (((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text))
with check (((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text));

create policy company_group_memberships_company_admin_read_write on public.company_group_memberships as permissive for all to authenticated
using ((((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text) OR (EXISTS ( SELECT 1
   FROM company_memberships cm
  WHERE ((cm.company_id = company_group_memberships.company_id) AND (cm.user_id = auth.uid()) AND (cm.membership_status = 'Active'::text) AND (cm.access_role = ANY (ARRAY['Company Admin'::text, 'Platform Admin'::text])))))))
with check ((((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text) OR (EXISTS ( SELECT 1
   FROM company_memberships cm
  WHERE ((cm.company_id = company_group_memberships.company_id) AND (cm.user_id = auth.uid()) AND (cm.membership_status = 'Active'::text) AND (cm.access_role = ANY (ARRAY['Company Admin'::text, 'Platform Admin'::text])))))));

create policy company_group_memberships_self_read on public.company_group_memberships as permissive for select to authenticated
using ((((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text) OR (user_id = ( SELECT auth.uid() AS uid))));

create policy company_groups_admin_write on public.company_groups as permissive for all to authenticated
using (((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text))
with check (((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text));

create policy company_groups_company_admin_read_write on public.company_groups as permissive for all to authenticated
using ((((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text) OR (EXISTS ( SELECT 1
   FROM company_memberships cm
  WHERE ((cm.company_id = company_groups.company_id) AND (cm.user_id = auth.uid()) AND (cm.membership_status = 'Active'::text) AND (cm.access_role = ANY (ARRAY['Company Admin'::text, 'Platform Admin'::text])))))))
with check ((((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text) OR (EXISTS ( SELECT 1
   FROM company_memberships cm
  WHERE ((cm.company_id = company_groups.company_id) AND (cm.user_id = auth.uid()) AND (cm.membership_status = 'Active'::text) AND (cm.access_role = ANY (ARRAY['Company Admin'::text, 'Platform Admin'::text])))))));

create policy company_groups_company_read on public.company_groups as permissive for select to authenticated
using ((((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text) OR (EXISTS ( SELECT 1
   FROM company_memberships cm
  WHERE ((cm.company_id = company_groups.company_id) AND (cm.user_id = ( SELECT auth.uid() AS uid)))))));

create policy company_invitations_company_admin_all on public.company_invitations as permissive for all to authenticated
using ((((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text) OR (EXISTS ( SELECT 1
   FROM company_memberships cm
  WHERE ((cm.company_id = company_invitations.company_id) AND (cm.user_id = auth.uid()) AND (cm.membership_status = 'Active'::text) AND (cm.access_role = ANY (ARRAY['Company Admin'::text, 'Platform Admin'::text])))))))
with check ((((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text) OR (EXISTS ( SELECT 1
   FROM company_memberships cm
  WHERE ((cm.company_id = company_invitations.company_id) AND (cm.user_id = auth.uid()) AND (cm.membership_status = 'Active'::text) AND (cm.access_role = ANY (ARRAY['Company Admin'::text, 'Platform Admin'::text])))))));

create policy company_invitations_invitee_update on public.company_invitations as permissive for update to authenticated
using (((lower(email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (status = 'Pending'::text)))
with check ((lower(email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))));

create policy company_invitations_public_token_read on public.company_invitations as permissive for select to anon, authenticated
using (((status = 'Pending'::text) AND (token IS NOT NULL) AND ((expires_at IS NULL) OR (expires_at > now()))));

create policy invitations_admin_write on public.company_invitations as permissive for all to public
using (((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text))
with check (((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text));

create policy memberships_admin_or_self_read on public.company_memberships as permissive for select to public
using ((((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text) OR (user_id = auth.uid())));

create policy memberships_admin_write on public.company_memberships as permissive for all to public
using (((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text))
with check (((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text));

create policy folder_shares_access on public.folder_shares as permissive for all to public
using (((auth.uid() = owner_id) OR (shared_with_email = (auth.jwt() ->> 'email'::text)) OR ((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text)));

create policy folders_owner on public.folders as permissive for all to public
using (((auth.uid() = user_id) OR ((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text)));

create policy rows_owner_admin_supplier_insert on public.negotiation_rows as permissive for insert to authenticated
with check ((((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text) OR (user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM (company_memberships cm
     JOIN companies c ON ((c.id = cm.company_id)))
  WHERE ((cm.user_id = ( SELECT auth.uid() AS uid)) AND (cm.membership_status = 'Active'::text) AND (c.type = 'Supplier'::text) AND (lower(COALESCE(negotiation_rows.supplier, ''::text)) = lower(COALESCE(c.name, ''::text))))))));

create policy rows_owner_admin_supplier_shared_read on public.negotiation_rows as permissive for select to authenticated
using ((((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text) OR (EXISTS ( SELECT 1
   FROM profiles ap
  WHERE ((ap.id = auth.uid()) AND (ap.role = 'admin'::text)))) OR (auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM ((company_memberships my_cm
     JOIN company_memberships target_cm ON ((target_cm.company_id = my_cm.company_id)))
     JOIN companies c ON ((c.id = my_cm.company_id)))
  WHERE ((my_cm.user_id = auth.uid()) AND (my_cm.membership_status = 'Active'::text) AND (target_cm.user_id = negotiation_rows.user_id) AND (target_cm.membership_status = 'Active'::text) AND (c.type = 'Brand'::text)))) OR (EXISTS ( SELECT 1
   FROM (company_memberships cm
     JOIN companies c ON ((c.id = cm.company_id)))
  WHERE ((cm.user_id = auth.uid()) AND (cm.membership_status = 'Active'::text) AND (c.type = 'Supplier'::text) AND (lower(COALESCE(negotiation_rows.supplier, ''::text)) = lower(COALESCE(c.name, ''::text)))))) OR (EXISTS ( SELECT 1
   FROM ((company_memberships cm
     JOIN companies c ON ((c.id = cm.company_id)))
     JOIN supplier_brand_access a ON (((lower(a.brand_company) = lower(c.name)) AND (lower(a.supplier_company) = lower(COALESCE(negotiation_rows.supplier, ''::text))) AND (COALESCE(a.status, 'Active'::text) = 'Active'::text))))
  WHERE ((cm.user_id = auth.uid()) AND (cm.membership_status = 'Active'::text) AND (c.type = 'Brand'::text) AND ((COALESCE(a.group_name, ''::text) = ''::text) OR (EXISTS ( SELECT 1
           FROM (company_group_memberships cgm
             JOIN company_groups cg ON ((cg.id = cgm.company_group_id)))
          WHERE ((cgm.user_id = auth.uid()) AND (cgm.company_id = cm.company_id) AND (lower(cg.name) = lower(a.group_name))))))))) OR (EXISTS ( SELECT 1
   FROM ((style_collection_assignments sca
     JOIN company_memberships cm ON ((cm.user_id = auth.uid())))
     JOIN companies c ON ((c.id = cm.company_id)))
  WHERE ((sca.row_id = negotiation_rows.id) AND (cm.membership_status = 'Active'::text) AND (lower(c.name) = lower(COALESCE(sca.owner_company, ''::text))) AND (c.type = COALESCE(sca.owner_type, 'Brand'::text)) AND ((COALESCE(sca.owner_group, ''::text) = ''::text) OR (EXISTS ( SELECT 1
           FROM (company_group_memberships cgm
             JOIN company_groups cg ON ((cg.id = cgm.company_group_id)))
          WHERE ((cgm.user_id = auth.uid()) AND (cgm.company_id = cm.company_id) AND (lower(cg.name) = lower(sca.owner_group)))))))))));

create policy rows_owner_admin_supplier_update on public.negotiation_rows as permissive for update to authenticated
using ((((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text) OR (user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM (company_memberships cm
     JOIN companies c ON ((c.id = cm.company_id)))
  WHERE ((cm.user_id = ( SELECT auth.uid() AS uid)) AND (cm.membership_status = 'Active'::text) AND (c.type = 'Supplier'::text) AND (lower(COALESCE(negotiation_rows.supplier, ''::text)) = lower(COALESCE(c.name, ''::text))))))))
with check ((((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text) OR (user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM (company_memberships cm
     JOIN companies c ON ((c.id = cm.company_id)))
  WHERE ((cm.user_id = ( SELECT auth.uid() AS uid)) AND (cm.membership_status = 'Active'::text) AND (c.type = 'Supplier'::text) AND (lower(COALESCE(negotiation_rows.supplier, ''::text)) = lower(COALESCE(c.name, ''::text))))))));

create policy rows_owner_company_supplier_delete on public.negotiation_rows as permissive for delete to authenticated
using ((((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text) OR (EXISTS ( SELECT 1
   FROM profiles ap
  WHERE ((ap.id = auth.uid()) AND (ap.role = 'admin'::text)))) OR (user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM (company_memberships cm
     JOIN companies c ON ((c.id = cm.company_id)))
  WHERE ((cm.user_id = auth.uid()) AND (cm.membership_status = 'Active'::text) AND (c.type = 'Supplier'::text) AND (lower(COALESCE(negotiation_rows.supplier, ''::text)) = lower(COALESCE(c.name, ''::text)))))) OR (EXISTS ( SELECT 1
   FROM ((company_memberships my_cm
     JOIN company_memberships owner_cm ON ((owner_cm.company_id = my_cm.company_id)))
     JOIN companies c ON ((c.id = my_cm.company_id)))
  WHERE ((my_cm.user_id = auth.uid()) AND (my_cm.membership_status = 'Active'::text) AND (my_cm.access_role = ANY (ARRAY['Company Admin'::text, 'Platform Admin'::text])) AND (owner_cm.user_id = negotiation_rows.user_id) AND (owner_cm.membership_status = 'Active'::text) AND (c.type = 'Brand'::text))))));

create policy profiles_company_admin_read on public.profiles as permissive for select to authenticated
using (((id = auth.uid()) OR ((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text) OR (EXISTS ( SELECT 1
   FROM (company_memberships my_cm
     JOIN company_memberships target_cm ON ((target_cm.company_id = my_cm.company_id)))
  WHERE ((my_cm.user_id = auth.uid()) AND (my_cm.membership_status = 'Active'::text) AND (my_cm.access_role = ANY (ARRAY['Company Admin'::text, 'Platform Admin'::text])) AND (target_cm.user_id = profiles.id))))));

create policy profiles_company_admin_update on public.profiles as permissive for update to authenticated
using (((id = auth.uid()) OR ((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text) OR (EXISTS ( SELECT 1
   FROM (company_memberships my_cm
     JOIN company_memberships target_cm ON ((target_cm.company_id = my_cm.company_id)))
  WHERE ((my_cm.user_id = auth.uid()) AND (my_cm.membership_status = 'Active'::text) AND (my_cm.access_role = ANY (ARRAY['Company Admin'::text, 'Platform Admin'::text])) AND (target_cm.user_id = profiles.id))))))
with check (((id = auth.uid()) OR ((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text) OR (EXISTS ( SELECT 1
   FROM (company_memberships my_cm
     JOIN company_memberships target_cm ON ((target_cm.company_id = my_cm.company_id)))
  WHERE ((my_cm.user_id = auth.uid()) AND (my_cm.membership_status = 'Active'::text) AND (my_cm.access_role = ANY (ARRAY['Company Admin'::text, 'Platform Admin'::text])) AND (target_cm.user_id = profiles.id))))));

create policy profiles_self on public.profiles as permissive for all to public
using (((auth.uid() = id) OR ((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text)));

create policy collections_delete_owner_or_admin on public.showroom_collections_scoped as permissive for delete to authenticated
using ((((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text) OR (created_by = auth.uid()) OR (EXISTS ( SELECT 1
   FROM (company_memberships cm
     JOIN companies c ON ((c.id = cm.company_id)))
  WHERE ((cm.user_id = auth.uid()) AND (cm.membership_status = 'Active'::text) AND (cm.access_role = ANY (ARRAY['Company Admin'::text, 'Platform Admin'::text])) AND (lower(c.name) = lower(COALESCE(showroom_collections_scoped.owner_company, ''::text))) AND (c.type = COALESCE(showroom_collections_scoped.owner_type, 'Brand'::text)))))));

create policy collections_insert_scoped on public.showroom_collections_scoped as permissive for insert to authenticated
with check (((( SELECT (auth.jwt() ->> 'email'::text)) = 'hello@athletestandards.com'::text) OR ((created_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM (((company_memberships cm
     JOIN companies c ON ((c.id = cm.company_id)))
     LEFT JOIN company_group_memberships cgm ON (((cgm.company_id = cm.company_id) AND (cgm.user_id = cm.user_id))))
     LEFT JOIN company_groups cg ON ((cg.id = cgm.company_group_id)))
  WHERE ((cm.user_id = ( SELECT auth.uid() AS uid)) AND (cm.membership_status = 'Active'::text) AND (lower(c.name) = lower(COALESCE(showroom_collections_scoped.owner_company, ''::text))) AND (c.type = COALESCE(showroom_collections_scoped.owner_type, 'Brand'::text)) AND ((COALESCE(showroom_collections_scoped.owner_group, ''::text) = ''::text) OR (lower(cg.name) = lower(showroom_collections_scoped.owner_group)))))))));

create policy collections_select_scoped on public.showroom_collections_scoped as permissive for select to authenticated
using (((( SELECT (auth.jwt() ->> 'email'::text)) = 'hello@athletestandards.com'::text) OR (created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM (((company_memberships cm
     JOIN companies c ON ((c.id = cm.company_id)))
     LEFT JOIN company_group_memberships cgm ON (((cgm.company_id = cm.company_id) AND (cgm.user_id = cm.user_id))))
     LEFT JOIN company_groups cg ON ((cg.id = cgm.company_group_id)))
  WHERE ((cm.user_id = ( SELECT auth.uid() AS uid)) AND (cm.membership_status = 'Active'::text) AND (lower(c.name) = lower(COALESCE(showroom_collections_scoped.owner_company, ''::text))) AND (c.type = COALESCE(showroom_collections_scoped.owner_type, 'Brand'::text)) AND ((COALESCE(showroom_collections_scoped.owner_group, ''::text) = ''::text) OR (lower(cg.name) = lower(showroom_collections_scoped.owner_group))))))));

create policy collections_update_owner_or_admin on public.showroom_collections_scoped as permissive for update to authenticated
using ((((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text) OR (created_by = auth.uid()) OR (EXISTS ( SELECT 1
   FROM (company_memberships cm
     JOIN companies c ON ((c.id = cm.company_id)))
  WHERE ((cm.user_id = auth.uid()) AND (cm.membership_status = 'Active'::text) AND (cm.access_role = ANY (ARRAY['Company Admin'::text, 'Platform Admin'::text])) AND (lower(c.name) = lower(COALESCE(showroom_collections_scoped.owner_company, ''::text))) AND (c.type = COALESCE(showroom_collections_scoped.owner_type, 'Brand'::text)))))))
with check ((((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text) OR (created_by = auth.uid()) OR (EXISTS ( SELECT 1
   FROM (company_memberships cm
     JOIN companies c ON ((c.id = cm.company_id)))
  WHERE ((cm.user_id = auth.uid()) AND (cm.membership_status = 'Active'::text) AND (cm.access_role = ANY (ARRAY['Company Admin'::text, 'Platform Admin'::text])) AND (lower(c.name) = lower(COALESCE(showroom_collections_scoped.owner_company, ''::text))) AND (c.type = COALESCE(showroom_collections_scoped.owner_type, 'Brand'::text)))))));

create policy assignments_delete_scoped on public.style_collection_assignments as permissive for delete to authenticated
using ((((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text) OR (created_by = auth.uid()) OR (EXISTS ( SELECT 1
   FROM (company_memberships cm
     JOIN companies c ON ((c.id = cm.company_id)))
  WHERE ((cm.user_id = auth.uid()) AND (cm.membership_status = 'Active'::text) AND (cm.access_role = ANY (ARRAY['Company Admin'::text, 'Platform Admin'::text])) AND (lower(c.name) = lower(COALESCE(style_collection_assignments.owner_company, ''::text))) AND (c.type = COALESCE(style_collection_assignments.owner_type, 'Brand'::text)))))));

create policy assignments_insert_scoped on public.style_collection_assignments as permissive for insert to authenticated
with check (((( SELECT (auth.jwt() ->> 'email'::text)) = 'hello@athletestandards.com'::text) OR (EXISTS ( SELECT 1
   FROM (((company_memberships cm
     JOIN companies c ON ((c.id = cm.company_id)))
     LEFT JOIN company_group_memberships cgm ON (((cgm.company_id = cm.company_id) AND (cgm.user_id = cm.user_id))))
     LEFT JOIN company_groups cg ON ((cg.id = cgm.company_group_id)))
  WHERE ((cm.user_id = ( SELECT auth.uid() AS uid)) AND (cm.membership_status = 'Active'::text) AND (lower(c.name) = lower(COALESCE(style_collection_assignments.owner_company, ''::text))) AND (c.type = COALESCE(style_collection_assignments.owner_type, 'Brand'::text)) AND ((COALESCE(style_collection_assignments.owner_group, ''::text) = ''::text) OR (lower(cg.name) = lower(style_collection_assignments.owner_group))))))));

create policy assignments_select_scoped on public.style_collection_assignments as permissive for select to authenticated
using (((( SELECT (auth.jwt() ->> 'email'::text)) = 'hello@athletestandards.com'::text) OR (created_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM (((company_memberships cm
     JOIN companies c ON ((c.id = cm.company_id)))
     LEFT JOIN company_group_memberships cgm ON (((cgm.company_id = cm.company_id) AND (cgm.user_id = cm.user_id))))
     LEFT JOIN company_groups cg ON ((cg.id = cgm.company_group_id)))
  WHERE ((cm.user_id = ( SELECT auth.uid() AS uid)) AND (cm.membership_status = 'Active'::text) AND (lower(c.name) = lower(COALESCE(style_collection_assignments.owner_company, ''::text))) AND (c.type = COALESCE(style_collection_assignments.owner_type, 'Brand'::text)) AND ((COALESCE(style_collection_assignments.owner_group, ''::text) = ''::text) OR (lower(cg.name) = lower(style_collection_assignments.owner_group))))))));

create policy assignments_update_scoped on public.style_collection_assignments as permissive for update to authenticated
using ((((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text) OR (created_by = auth.uid()) OR (EXISTS ( SELECT 1
   FROM (company_memberships cm
     JOIN companies c ON ((c.id = cm.company_id)))
  WHERE ((cm.user_id = auth.uid()) AND (cm.membership_status = 'Active'::text) AND (cm.access_role = ANY (ARRAY['Company Admin'::text, 'Platform Admin'::text])) AND (lower(c.name) = lower(COALESCE(style_collection_assignments.owner_company, ''::text))) AND (c.type = COALESCE(style_collection_assignments.owner_type, 'Brand'::text)))))))
with check ((((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text) OR (created_by = auth.uid()) OR (EXISTS ( SELECT 1
   FROM (company_memberships cm
     JOIN companies c ON ((c.id = cm.company_id)))
  WHERE ((cm.user_id = auth.uid()) AND (cm.membership_status = 'Active'::text) AND (cm.access_role = ANY (ARRAY['Company Admin'::text, 'Platform Admin'::text])) AND (lower(c.name) = lower(COALESCE(style_collection_assignments.owner_company, ''::text))) AND (c.type = COALESCE(style_collection_assignments.owner_type, 'Brand'::text)))))));

create policy supplier_brand_access_brand_write on public.supplier_brand_access as permissive for all to public
using ((((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (COALESCE(p.company_type, 'Brand'::text) <> 'Supplier'::text) AND (lower(COALESCE(supplier_brand_access.brand_company, ''::text)) = lower(COALESCE(p.active_company_name, p.company_name, p.supplier_company, ''::text))))))))
with check ((((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (COALESCE(p.company_type, 'Brand'::text) <> 'Supplier'::text) AND (lower(COALESCE(supplier_brand_access.brand_company, ''::text)) = lower(COALESCE(p.active_company_name, p.company_name, p.supplier_company, ''::text))))))));

create policy supplier_brand_access_read on public.supplier_brand_access as permissive for select to public
using ((((auth.jwt() ->> 'email'::text) = 'hello@athletestandards.com'::text) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (lower(COALESCE(supplier_brand_access.brand_company, ''::text)) = lower(COALESCE(p.active_company_name, p.company_name, p.supplier_company, ''::text)))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND ((p.role = 'supplier'::text) OR (p.company_type = 'Supplier'::text)) AND (lower(COALESCE(supplier_brand_access.supplier_company, ''::text)) = lower(COALESCE(p.active_company_name, p.company_name, p.supplier_company, ''::text))))))));
