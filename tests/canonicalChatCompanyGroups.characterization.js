const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync('index.html', 'utf8');

assert(
  /async function loadCompanyGroupsForChat\(companyId\)/.test(source),
  'Chat should have a dedicated active-company group preload'
);
assert(
  /await loadCompanyGroupsForChat\(companyId\);\s*try\{\s*var gr=await GroupsDomain\.fetchNamesForUser/.test(source),
  'Active company groups must be loaded before user group names are resolved'
);
assert(
  /COMPANY_GROUPS_LOADED\[companyKey\(companyName\)\]=true;/.test(source),
  'Persisted company groups should be marked loaded after caching'
);
assert(
  /function canonicalChatActiveGroupId\(\)\{[\s\S]*companyPersistedGroups\(activeCompanyName&&activeCompanyName\(\)\|\|''\)[\s\S]*isUuidString\(matched\.id\)/.test(source),
  'Canonical Chat must derive a UUID brand company group from persisted groups'
);
assert(
  /function ensureCanonicalChatGroupsReady\(\)\{[\s\S]*sb\.from\('companies'\)\.select\('id,name,type,status'\)\.ilike\('name',companyName\)[\s\S]*loadCompanyGroupsForChat\(company\.id\)/.test(source),
  'Canonical Chat must recover groups by active company name when session preload is missing'
);
assert(
  /Preparing chat/.test(source),
  'Product chat should show a loading state instead of final unavailable while group UUID is being fetched'
);

console.log('canonical chat company group preload characterization ok');
