const fs = require('fs');
const vm = require('vm');

vm.runInThisContext(fs.readFileSync('src/features/collections/collectionModel.js', 'utf8'));
vm.runInThisContext(fs.readFileSync('src/features/collections/collectionService.js', 'utf8'));

const norm = value => String(value || '').trim().toLowerCase();
const ids = rows => rows.map(row => row.id).join(',');

function oldScope(type, company, group) {
  type = String(type || 'Brand').toLowerCase();
  let key = type + ':' + norm(company || '');
  group = norm(group || '');
  return group ? key + ':' + group : key;
}
function oldParts(key) {
  const parts = String(key || '').split(':');
  return { type: parts[0] || '', company: parts[1] || '', group: parts.slice(2).join(':') };
}
function oldBrandMapHasName(map, meta, name) {
  map = map || {};
  meta = meta || {};
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
    if (parts.group === group) return true;
    return !!(group && !parts.group);
  });
}
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
function oldRowsForMeta(meta, context) {
  meta = meta || {};
  const name = meta.name || '';
  const type = meta.owner_type || 'Brand';
  const company = meta.owner_company || '';
  const assignedIds = {};
  (context.assignments || []).forEach(assignment => {
    if (oldAssignmentMatches(assignment, meta, name)) assignedIds[String(assignment.row_id)] = true;
  });
  return context.rows.filter(row => {
    if (String(type) === 'Supplier') return norm(row.supplier) === norm(company) && (row.collections || []).indexOf(name) >= 0;
    if (assignedIds[String(row.id)]) return true;
    return oldBrandMapHasName(row.brandMap || {}, meta, name);
  });
}
function oldRows(name, context) {
  const meta = context.collectionMetaByRef(name) || {};
  const display = context.collectionDisplayName(name, meta);
  if (meta.name && !context.collectionOwnedByActiveCompany(meta)) return [];
  const rows = meta && meta.name
    ? oldRowsForMeta(meta, context)
    : context.rows.filter(row => context.currentStyleCollections(row).indexOf(display) >= 0);
  return rows.filter(row => !context.authProfile || context.adminBypass || context.canAccessRowForCurrentUser(row));
}

function serviceRowsForMeta(meta, context) {
  return collectionRowsForMetaRead(meta, {
    rows: context.rows,
    assignments: context.assignments,
    normalizeName: norm,
    assignmentMatchesCollectionMeta: oldAssignmentMatches,
    styleCollections: row => row.collections || [],
    styleBrandCollectionMap: row => row.brandMap || {},
    brandCollectionMapHasNameForMeta: oldBrandMapHasName
  });
}
function serviceRows(name, context) {
  return collectionRowsRead(name, {
    rows: context.rows,
    assignments: context.assignments,
    authProfile: context.authProfile,
    adminBypass: context.adminBypass,
    collectionMetaByRef: context.collectionMetaByRef,
    collectionDisplayName: context.collectionDisplayName,
    collectionOwnedByActiveCompany: context.collectionOwnedByActiveCompany,
    collectionRowsForMeta: meta => serviceRowsForMeta(meta, context),
    currentStyleCollections: context.currentStyleCollections,
    canAccessRowForCurrentUser: context.canAccessRowForCurrentUser
  });
}

const rows = [
  { id: 1, supplier: 'STW', collections: ['Supplier A'], brandMap: {}, accessible: true },
  { id: 2, supplier: 'Kam Limited', collections: ['Capsule A'], brandMap: { 'brand:gloria jeans': ['Brand A'] }, accessible: true },
  { id: 3, supplier: 'STW', collections: ['Supplier A', 'Supplier B'], brandMap: { 'brand:gloria jeans:boys 13+': ['Group A'] }, accessible: true },
  { id: 4, supplier: 'Other', collections: [], brandMap: {}, accessible: true },
  { id: 5, supplier: 'STW', collections: ['Overlap'], brandMap: { 'brand:gloria jeans': ['Overlap'] }, accessible: true },
  { id: 6, supplier: 'Hidden', collections: ['Hidden'], brandMap: { 'brand:other': ['Other'] }, accessible: false },
  { id: 7, supplier: 'STW', collections: ['Supplier A'], brandMap: { 'brand:gloria jeans': ['Supplier A'] }, accessible: true }
];
const assignments = [
  { row_id: 4, collection_name: 'Brand A', owner_type: 'Brand', owner_company: 'Gloria Jeans', owner_group: '' },
  { row_id: 5, collection_name: 'Overlap', owner_type: 'Brand', owner_company: 'Gloria Jeans', owner_group: '' },
  { row_id: 6, collection_name: 'Group A', owner_type: 'Brand', owner_company: 'Gloria Jeans', owner_group: 'Boys 13+' }
];
const metaByName = {
  Personal: { name: 'Personal', owner_type: 'Brand', owner_company: 'Gloria Jeans', owner_group: '' },
  'Brand A': { name: 'Brand A', owner_type: 'Brand', owner_company: 'Gloria Jeans', owner_group: '' },
  'Group A': { name: 'Group A', owner_type: 'Brand', owner_company: 'Gloria Jeans', owner_group: 'Boys 13+' },
  'Supplier A': { name: 'Supplier A', owner_type: 'Supplier', owner_company: 'STW', owner_group: '' },
  'Supplier B': { name: 'Supplier B', owner_type: 'Supplier', owner_company: 'STW', owner_group: '' },
  'Capsule A': { name: 'Capsule A', owner_type: 'Supplier', owner_company: 'Kam Limited', owner_group: '' },
  Overlap: { name: 'Overlap', owner_type: 'Brand', owner_company: 'Gloria Jeans', owner_group: '' },
  Zero: { name: 'Zero', owner_type: 'Brand', owner_company: 'Gloria Jeans', owner_group: '' },
  Other: { name: 'Other', owner_type: 'Brand', owner_company: 'Other', owner_group: '' }
};
function context(overrides) {
  return Object.assign({
    rows,
    assignments,
    authProfile: { id: 'user' },
    adminBypass: false,
    collectionMetaByRef: name => metaByName[name] || {},
    collectionDisplayName: (name, meta) => (meta && meta.name) || name || '',
    collectionOwnedByActiveCompany: meta => (meta.owner_company || '') === 'Gloria Jeans' || meta.owner_type === 'Supplier',
    currentStyleCollections: row => (row.collections || []).concat(...Object.values(row.brandMap || {})),
    canAccessRowForCurrentUser: row => row.accessible !== false
  }, overrides || {});
}

const scenarios = [
  ['personal collection', 'Personal', context()],
  ['company collection', 'Brand A', context()],
  ['group collection', 'Group A', context()],
  ['user in one group', 'Group A', context()],
  ['user in multiple groups', 'Group A', context()],
  ['company admin', 'Brand A', context()],
  ['platform admin', 'Other', context({ adminBypass: true, collectionOwnedByActiveCompany: () => true })],
  ['platform admin view-as', 'Brand A', context()],
  ['supplier collection', 'Supplier A', context()],
  ['brand collection', 'Brand A', context()],
  ['assignment-table membership', 'Brand A', context()],
  ['BRAND_COLLECTIONS notes membership', 'Brand A', context({ assignments: [] })],
  ['COLLECTIONS notes membership', 'Supplier A', context({ assignments: [] })],
  ['capsule fallback', 'Capsule A', context({ assignments: [] })],
  ['style belonging to multiple collections', 'Supplier B', context()],
  ['style with no collection', 'Missing', context()],
  ['inaccessible style', 'Group A', context()],
  ['deleted/missing collection metadata', 'Ghost', context()],
  ['collection with zero styles', 'Zero', context()],
  ['duplicate/overlapping membership mechanisms', 'Overlap', context()]
];

scenarios.forEach(([label, name, ctx]) => {
  const oldForMeta = oldRowsForMeta(ctx.collectionMetaByRef(name), ctx);
  const newForMeta = serviceRowsForMeta(ctx.collectionMetaByRef(name), ctx);
  const oldFull = oldRows(name, ctx);
  const newFull = serviceRows(name, ctx);
  if (ids(oldForMeta) !== ids(newForMeta)) throw new Error(label + ' rowsForMeta mismatch: ' + ids(oldForMeta) + ' !== ' + ids(newForMeta));
  if (ids(oldFull) !== ids(newFull)) throw new Error(label + ' collectionRows mismatch: ' + ids(oldFull) + ' !== ' + ids(newFull));
});

console.log('collections read engine characterization ok ' + scenarios.length);
