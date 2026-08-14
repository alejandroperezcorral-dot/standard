const assert = require('assert');
const contract = require('../supabase/functions/calculate-style-cost/contract.js');

assert.deepStrictEqual(contract.normalizeStyleIds([1, '2', 2]), {
  ok: true,
  error: null,
  styleIds: [1, 2]
});
assert.strictEqual(contract.normalizeStyleIds([]).error, 'STYLE_IDS_REQUIRED');
assert.strictEqual(contract.normalizeStyleIds([1.2]).error, 'INVALID_STYLE_ID');
assert.strictEqual(contract.normalizeStyleIds(Array.from({ length: 101 }, (_, i) => i + 1)).error, 'STYLE_IDS_LIMIT_EXCEEDED');

const companyAScope = {
  company: { name: 'Company A', type: 'Brand' },
  companyUserIds: { 'owner-a': true },
  groupNames: { boys: true },
  supplierAccess: {
    'supplier one': [{ supplier_company: 'Supplier One', brand_company: 'Company A', group_name: '' }],
    'supplier grouped': [{ supplier_company: 'Supplier Grouped', brand_company: 'Company A', group_name: 'BOYS' }]
  },
  collectionAssignments: {
    '4': [{ owner_company: 'Company A', owner_group: 'BOYS', owner_type: 'Brand' }]
  }
};

assert.strictEqual(contract.styleIsAuthorized({ id: 1, user_id: 'owner-a', supplier: 'Private' }, companyAScope), true);
assert.strictEqual(contract.styleIsAuthorized({ id: 2, user_id: 'other', supplier: 'Supplier One' }, companyAScope), true);
assert.strictEqual(contract.styleIsAuthorized({ id: 3, user_id: 'other', supplier: 'Supplier Grouped' }, companyAScope), true);
assert.strictEqual(contract.styleIsAuthorized({ id: 4, user_id: 'other', supplier: 'No Share' }, companyAScope), true);
assert.strictEqual(contract.styleIsAuthorized({ id: 5, user_id: 'other', supplier: 'No Share' }, companyAScope), false);

const supplierScope = {
  company: { name: 'Supplier One', type: 'Supplier' },
  companyUserIds: {},
  groupNames: {},
  supplierAccess: {},
  collectionAssignments: {}
};
assert.strictEqual(contract.styleIsAuthorized({ id: 6, user_id: 'other', supplier: 'supplier one' }, supplierScope), true);
assert.strictEqual(contract.styleIsAuthorized({ id: 7, user_id: 'other', supplier: 'supplier two' }, supplierScope), false);

const safe = contract.sanitizeCostResult(10, {
  fob: 7.5,
  selectedFob: 7.5,
  landedCost: 9,
  imu: 0.7,
  mu: 2.33,
  gap: -0.02,
  fobT: 6,
  cu: 0.3,
  cust: 1.2,
  custPct: 0.16,
  days: 65,
  assumptions: { secret: true },
  resolutionTrace: [{ secret: true }]
}, { currency: 'USD', configurationVersion: 'ACTIVE-1' });
assert.strictEqual(safe.styleId, 10);
assert.strictEqual(safe.status, 'READY');
assert.strictEqual(safe.configurationVersion, 'ACTIVE-1');
assert.strictEqual(contract.responseContainsForbiddenKey(safe), false);
assert.strictEqual(contract.responseContainsForbiddenKey({ results: [safe], base_config: {} }), true);

console.log('secure costing edge contract characterization passed');
