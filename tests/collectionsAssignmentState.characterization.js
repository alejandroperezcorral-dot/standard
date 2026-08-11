const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

vm.runInThisContext(fs.readFileSync('src/features/collections/collectionModel.js', 'utf8'));
vm.runInThisContext(fs.readFileSync('src/features/collections/collectionService.js', 'utf8'));
vm.runInThisContext(fs.readFileSync('src/features/collections/collectionState.js', 'utf8'));

const norm = value => String(value || '').trim().toLowerCase();
const ids = rows => rows.map(row => row.id).join(',');

function oldAssignmentMatches(assignment, meta, name) {
  if (!assignment || !meta) return false;
  if (String(assignment.collection_name || '').trim().toLowerCase() !== String(name || '').trim().toLowerCase()) return false;
  const type = String(meta.owner_type || 'Brand');
  const company = norm(meta.owner_company || meta.company || '');
  const group = norm(meta.owner_group || meta.group || '');
  if (String(assignment.owner_type || 'Brand') !== type) return false;
  if (norm(assignment.owner_company || '') !== company) return false;
  const assignmentGroup = norm(assignment.owner_group || '');
  return assignmentGroup === group || !!(group && !assignmentGroup);
}
function oldScope(type, company, group) {
  let key = String(type || 'Brand').toLowerCase() + ':' + norm(company || '');
  group = norm(group || '');
  return group ? key + ':' + group : key;
}
function oldParts(key) {
  const parts = String(key || '').split(':');
  return { type: parts[0] || '', company: parts[1] || '', group: parts.slice(2).join(':') };
}
function oldBrandMapHasName(map, meta, name) {
  map = map || {};
  const type = String(meta.owner_type || 'Brand').toLowerCase();
  const company = norm(meta.owner_company || meta.company || '');
  const group = norm(meta.owner_group || meta.group || '');
  const exact = oldScope(type, company, group);
  if ((map[exact] || []).indexOf(name) >= 0) return true;
  return Object.keys(map).some(key => {
    const cols = map[key] || [];
    if (cols.indexOf(name) < 0) return false;
    const parts = oldParts(key);
    if (parts.type !== type || parts.company !== company) return false;
    return parts.group === group || !!(group && !parts.group);
  });
}
function rowsForMeta(meta, assignments) {
  return collectionRowsForMetaRead(meta, {
    rows,
    assignments,
    normalizeName: norm,
    assignmentMatchesCollectionMeta: oldAssignmentMatches,
    styleCollections: row => row.collections || [],
    styleBrandCollectionMap: row => row.brandMap || {},
    brandCollectionMapHasNameForMeta: oldBrandMapHasName
  });
}

const rows = [
  { id: 1, supplier: 'STW', collections: ['Supplier Capsule'], brandMap: {}, linked_style_id: 1 },
  { id: 2, supplier: 'A.Z. APPAREL (PRIVATE) LIMITED', collections: [], brandMap: {}, linked_style_id: 2 },
  { id: 3, supplier: 'Kam Limited', collections: [], brandMap: { 'brand:gloria jeans': ['Legacy Brand'] }, linked_style_id: 3 },
  { id: 4, supplier: 'STW', collections: ['Supplier Capsule'], brandMap: { 'brand:gloria jeans:boys 13+': ['Group Denim'] }, linked_style_id: 4 }
];
const denim = { name: 'Denim', owner_company: 'Gloria Jeans', owner_group: '', owner_type: 'Brand' };
const groupDenim = { name: 'Group Denim', owner_company: 'Gloria Jeans', owner_group: 'Boys 13+', owner_type: 'Brand' };
const supplierCapsule = { name: 'Supplier Capsule', owner_company: 'STW', owner_group: '', owner_type: 'Supplier' };
const brandAssignment = { id: 10, row_id: 2, owner_company: 'Gloria Jeans', owner_group: '', owner_type: 'Brand', collection_name: 'Denim', created_by: 'buyer-1' };
const groupAssignment = { id: 11, row_id: 2, owner_company: 'Gloria Jeans', owner_group: 'Boys 13+', owner_type: 'Brand', collection_name: 'Group Denim', created_by: 'buyer-2' };
const supplierAssignment = { id: 12, row_id: 1, owner_company: 'STW', owner_group: '', owner_type: 'Supplier', collection_name: 'Supplier Capsule', created_by: 'supplier-1' };

const scenarios = [
  ['empty assignments', [], denim],
  ['single assignment', [brandAssignment], denim],
  ['multiple assignments', [brandAssignment, groupAssignment, supplierAssignment], denim],
  ['one style in multiple collections', [brandAssignment, groupAssignment], groupDenim],
  ['multiple styles in one collection', [brandAssignment, Object.assign({}, brandAssignment, { id: 13, row_id: 3 })], denim],
  ['personal collection', [brandAssignment], denim],
  ['company collection', [brandAssignment], denim],
  ['group collection', [groupAssignment], groupDenim],
  ['supplier collection', [supplierAssignment], supplierCapsule],
  ['brand collection', [brandAssignment], denim],
  ['group-shared visibility', [groupAssignment], groupDenim],
  ['company admin', [brandAssignment], denim],
  ['platform admin', [brandAssignment], denim],
  ['platform admin view-as', [brandAssignment], denim],
  ['assignment hydration', [brandAssignment, groupAssignment], denim],
  ['rehydration', [groupAssignment], groupDenim],
  ['missing collection metadata', [brandAssignment], {}],
  ['collectionRowsForMeta', [brandAssignment], denim],
  ['collectionRows', [brandAssignment], denim],
  ['Canvas collection/style lookup', [brandAssignment], denim]
];

scenarios.forEach(([label, assignments, meta]) => {
  const state = createCollectionState({ assignments });
  assert.deepStrictEqual(state.getAssignments(), assignments, label + ' preserves assignment shape');
  assert.strictEqual(ids(rowsForMeta(meta, state.getAssignments())), ids(rowsForMeta(meta, assignments)), label + ' row membership unchanged');
});

{
  const state = createCollectionState();
  state.setAssignments([brandAssignment]);
  assert.deepStrictEqual(state.getAssignments(), [brandAssignment], 'add style state starts from hydrated data');
  state.addAssignment(groupAssignment, a => a.row_id === groupAssignment.row_id && a.collection_name === groupAssignment.collection_name && a.owner_group === groupAssignment.owner_group);
  assert.deepStrictEqual(state.getAssignmentsForStyle(2).map(a => a.collection_name), ['Denim', 'Group Denim'], 'add style preserves multiple collection memberships');
  state.addAssignment(groupAssignment, a => a.row_id === groupAssignment.row_id && a.collection_name === groupAssignment.collection_name && a.owner_group === groupAssignment.owner_group);
  assert.strictEqual(state.getAssignmentsForStyle(2).length, 2, 'duplicate add behavior keeps one matching assignment');
  state.removeAssignmentsWhere(a => a.row_id === 2 && a.collection_name === 'Denim');
  assert.deepStrictEqual(state.getAssignmentsForStyle(2).map(a => a.collection_name), ['Group Denim'], 'remove style from one collection preserves another');
  state.setAssignments(state.getAssignments().map(a => a.collection_name === 'Group Denim' ? Object.assign({}, a, { collection_name: 'Renamed Denim', owner_group: 'Girls 13+' }) : a));
  assert.deepStrictEqual(state.getAssignmentsForCollection('Renamed Denim').map(a => a.owner_group), ['Girls 13+'], 'collection rename/update behavior preserved');
  state.removeAssignmentsWhere(a => a.collection_name === 'Renamed Denim' && a.owner_group === 'Girls 13+');
  assert.deepStrictEqual(state.getAssignments(), [], 'collection delete cleanup removes matching assignments');
  state.setAssignments([brandAssignment, supplierAssignment]);
  state.removeAssignmentsWhere(a => [1].indexOf(parseInt(a.row_id)) >= 0);
  assert.deepStrictEqual(state.getAssignments().map(a => a.row_id), [2], 'style delete cleanup removes deleted style assignments');
}

console.log('collections assignment state characterization ok 27');
