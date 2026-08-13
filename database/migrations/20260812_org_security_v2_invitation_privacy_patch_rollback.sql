-- Rollback for STDTEX Organization Security v2 invitation privacy patch.
--
-- STAGING VALIDATION ONLY.
-- Restores the previous public pending-token read policy for baseline parity tests.

begin;

drop policy if exists company_invitations_public_token_read on public.company_invitations;

create policy company_invitations_public_token_read
on public.company_invitations
as permissive
for select
to anon, authenticated
using (
  status = 'Pending'
  and token is not null
  and (expires_at is null or expires_at > now())
);

commit;
