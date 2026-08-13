const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const service = fs.readFileSync(path.join(root, 'src/features/companies/organizationService.js'), 'utf8');

function assertNo(pattern, message) {
  assert(!pattern.test(indexHtml), message);
}

assert(
  indexHtml.includes('src/features/companies/organizationService.js'),
  'organizationService must be loaded before company UI code'
);

assertNo(
  /from\(['"]company_invitations['"]\)\.select\(['"]\*['"]\)\.eq\(['"]token['"]/,
  'anonymous invitation landing must not directly select company_invitations by token'
);

assertNo(
  /from\(['"]company_invitations['"]\)\.insert\(/,
  'company invitation creation must not use direct inserts'
);

assertNo(
  /from\(['"]company_invitations['"]\)\.update\(\{status:\s*['"]Cancelled['"]/,
  'company invitation revocation must not use direct status updates'
);

assertNo(
  /function acceptTeamInviteForUser[\s\S]*?from\(['"]profiles['"]\)\.(upsert|update|insert)[\s\S]*?function createRegistrationCompanyProfile/,
  'invitation acceptance must not perform client-side profile writes'
);

[
  'accept_company_invitation',
  'create_company_invitation',
  'revoke_company_invitation',
  'update_company_member',
  'remove_company_member',
  'update_own_profile'
].forEach((rpc) => {
  assert(service.includes(`rpc('${rpc}'`), `${rpc} wrapper is missing`);
});

assert(
  /showInviteFromUrl[\s\S]*TEAM_INVITE=\{token:token\}/.test(indexHtml),
  'invite landing should keep only the token in temporary state'
);

assert(
  /sessionStorage\.setItem\(['"]stdtex:pending-invite['"]/.test(indexHtml),
  'pending invite token should use temporary session storage'
);

assert(
  /clearPendingInviteToken\(\)/.test(indexHtml),
  'pending invite token must be cleared after terminal acceptance handling'
);

assert(
  /acceptPendingTeamInviteAfterLogin[\s\S]*await acceptTeamInviteForUser\(token\);[\s\S]*from\(['"]profiles['"]\)\.select\(['"]\*['"]\)[\s\S]*await hydrateAuthCompanyFromMembership\(\)/.test(indexHtml),
  'accepted invitations must refresh profile and active company membership before app routing'
);

assert(
  /function enterAuthenticatedRoute\(\)[\s\S]*applyRouteFromLocation\(\)[\s\S]*enterExploreAfterAuth\(\)/.test(indexHtml),
  'authenticated startup must preserve a valid direct route before falling back to Explore'
);

assert(
  /await load\(\);\s*enterAuthenticatedRoute\(\);/.test(indexHtml),
  'resolveAuth must route through direct-route aware authenticated startup'
);

console.log('organization frontend RPC characterization passed');
