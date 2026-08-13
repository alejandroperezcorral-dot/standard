-- STDTEX Organization Security v2 invitation privacy patch
-- Purpose: remove public invitation enumeration from company_invitations.
--
-- STAGING VALIDATION ONLY.
-- Do not apply to production without explicit approval.

begin;

drop policy if exists company_invitations_public_token_read on public.company_invitations;

comment on table public.company_invitations is
  'Security-sensitive company invitations. Direct public invite enumeration is disabled; acceptance must use controlled RPCs.';

commit;
