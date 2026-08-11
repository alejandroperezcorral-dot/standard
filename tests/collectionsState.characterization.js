const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

vm.runInThisContext(fs.readFileSync('src/features/collections/collectionState.js', 'utf8'));

const state = createCollectionState();
assert.deepStrictEqual(state.snapshot(), { scope: 'mine', groupFilters: [], collections: [], collectionMeta: {}, assignments: [] }, 'initial state matches legacy collections scope');

assert.strictEqual(state.setScope('groups'), 'groups', 'sets group scope');
assert.deepStrictEqual(state.snapshot(), { scope: 'groups', groupFilters: [], collections: [], collectionMeta: {}, assignments: [] }, 'scope change does not add filters');

state.setGroupFilters(['Boys 13+', 'Boys 13+', '', 'Girls 13+']);
assert.deepStrictEqual(state.getGroupFilters(), ['Boys 13+', 'Girls 13+'], 'deduplicates assigned group filters');

state.toggleGroupFilter('boys 13+', false, v => String(v || '').toLowerCase());
assert.deepStrictEqual(state.getGroupFilters(), ['Girls 13+'], 'removes group filters using injected normalization');

state.toggleGroupFilter('Boys 13+', true, v => String(v || '').toLowerCase());
assert.deepStrictEqual(state.getGroupFilters(), ['Girls 13+', 'Boys 13+'], 'adds selected group filter');

const copy = state.getGroupFilters();
copy.push('External mutation');
assert.deepStrictEqual(state.getGroupFilters(), ['Girls 13+', 'Boys 13+'], 'getGroupFilters returns a defensive copy');

state.resetGroupFilters();
assert.deepStrictEqual(state.getGroupFilters(), [], 'resetGroupFilters clears selected groups');

state.setScope('invalid');
assert.strictEqual(state.getScope(), 'mine', 'invalid scope falls back to mine like legacy behavior');

state.reset({ scope: 'groups', groupFilters: ['Denim'] });
assert.deepStrictEqual(state.snapshot(), { scope: 'groups', groupFilters: ['Denim'], collections: [], collectionMeta: {}, assignments: [] }, 'reset hydrates a known state');

state.reset();
assert.deepStrictEqual(state.snapshot(), { scope: 'mine', groupFilters: [], collections: [], collectionMeta: {}, assignments: [] }, 'reset without args returns initial state');

assert.deepStrictEqual(CollectionState.snapshot(), { scope: 'mine', groupFilters: [], collections: [], collectionMeta: {}, assignments: [] }, 'default singleton starts with legacy state');

state.setCollections(['B', 'A', 'B', '', null]);
assert.deepStrictEqual(state.getCollections(), ['B', 'A'], 'setCollections deduplicates and preserves hydrated order');

const collectionCopy = state.getCollections();
collectionCopy.push('External mutation');
assert.deepStrictEqual(state.getCollections(), ['B', 'A'], 'getCollections returns a defensive copy');

assert.strictEqual(state.hasCollection('A'), true, 'hasCollection finds existing collection');
assert.strictEqual(state.hasCollection('Missing'), false, 'hasCollection reports missing collection');

assert.strictEqual(state.addCollection('C'), true, 'addCollection appends a new collection');
assert.strictEqual(state.addCollection('C'), false, 'addCollection rejects duplicates');
assert.deepStrictEqual(state.getCollections(), ['B', 'A', 'C'], 'addCollection preserves insertion order');

state.normalizeCollections();
assert.deepStrictEqual(state.getCollections(), ['A', 'B', 'C'], 'normalizeCollections matches legacy dedupe and sort mutation points');

state.removeCollections(v => v === 'B');
assert.deepStrictEqual(state.getCollections(), ['A', 'C'], 'removeCollections removes matching refs');

state.reset({ scope: 'groups', groupFilters: ['Denim'], collections: ['Z', 'Y', 'Z'] });
assert.deepStrictEqual(state.snapshot(), { scope: 'groups', groupFilters: ['Denim'], collections: ['Z', 'Y'], collectionMeta: {}, assignments: [] }, 'reset hydrates collections without sorting');

const personalMeta = {
  scope: 'brand:gloria jeans',
  owner_company: 'Gloria Jeans',
  owner_group: '',
  owner_type: 'Brand',
  name: 'Personal',
  fsd: '2026-12-23',
  company: 'Gloria Jeans',
  group: '',
  created_by: 'user-1',
  created_by_email: 'buyer@example.com'
};
const groupMeta = Object.assign({}, personalMeta, {
  scope: 'brand:gloria jeans:boys 13+',
  owner_group: 'Boys 13+',
  name: 'Group Denim',
  group: 'Boys 13+'
});
const supplierMeta = {
  scope: 'supplier:stw',
  owner_company: 'STW',
  owner_group: '',
  owner_type: 'Supplier',
  name: 'Supplier Capsule',
  fsd: '2027-01-28',
  company: 'STW',
  group: '',
  created_by: 'supplier-1',
  created_by_email: 'supplier@example.com'
};

state.setCollectionMeta({
  'brand:gloria jeans::Personal': personalMeta,
  'brand:gloria jeans:boys 13+::Group Denim': groupMeta,
  'supplier:stw::Supplier Capsule': supplierMeta
});
assert.deepStrictEqual(state.getCollectionMetaKeys(), ['brand:gloria jeans::Personal', 'brand:gloria jeans:boys 13+::Group Denim', 'supplier:stw::Supplier Capsule'], 'metadata hydration preserves keys');
assert.deepStrictEqual(state.getCollectionMetaEntry('brand:gloria jeans::Personal'), personalMeta, 'personal collection metadata shape is preserved');
assert.deepStrictEqual(state.getCollectionMetaEntry('brand:gloria jeans:boys 13+::Group Denim'), groupMeta, 'group collection metadata shape is preserved');
assert.deepStrictEqual(state.getCollectionMetaEntry('supplier:stw::Supplier Capsule'), supplierMeta, 'supplier collection metadata shape is preserved');
assert.strictEqual(state.getCollectionMetaEntry('Missing'), undefined, 'missing metadata remains undefined');

const metaCopy = state.getCollectionMetaEntry('brand:gloria jeans::Personal');
metaCopy.name = 'Changed outside';
assert.strictEqual(state.getCollectionMetaEntry('brand:gloria jeans::Personal').name, 'Personal', 'getCollectionMetaEntry returns a defensive copy');

state.mergeCollectionMetaEntry('brand:gloria jeans::Partial', { name: 'Partial', owner_company: 'Gloria Jeans' });
state.mergeCollectionMetaEntry('brand:gloria jeans::Partial', { fsd: '2027-02-01' });
assert.deepStrictEqual(state.getCollectionMetaEntry('brand:gloria jeans::Partial'), { name: 'Partial', owner_company: 'Gloria Jeans', fsd: '2027-02-01' }, 'partial metadata refresh merges fields');

state.removeCollectionMetaEntry('brand:gloria jeans::Personal');
assert.strictEqual(state.getCollectionMetaEntry('brand:gloria jeans::Personal'), undefined, 'delete removes one metadata entry');

state.removeCollectionMetaWhere((key, meta) => meta.owner_company === 'Gloria Jeans' && meta.owner_group === 'Boys 13+');
assert.strictEqual(state.getCollectionMetaEntry('brand:gloria jeans:boys 13+::Group Denim'), undefined, 'predicate delete removes group metadata entries');

state.setCollectionMetaEntry('brand:gloria jeans::Renamed', Object.assign({}, personalMeta, { name: 'Renamed', fsd: '2027-03-01' }));
assert.strictEqual(state.getCollectionMetaEntry('brand:gloria jeans::Renamed').fsd, '2027-03-01', 'rename/update metadata stores updated FSD');

state.reset({ scope: 'groups', groupFilters: ['Boys 13+'], collections: ['brand:gloria jeans::Renamed'], collectionMeta: { 'brand:gloria jeans::Renamed': state.getCollectionMetaEntry('brand:gloria jeans::Renamed') } });
assert.deepStrictEqual(state.snapshot(), {
  scope: 'groups',
  groupFilters: ['Boys 13+'],
  collections: ['brand:gloria jeans::Renamed'],
  collectionMeta: { 'brand:gloria jeans::Renamed': Object.assign({}, personalMeta, { name: 'Renamed', fsd: '2027-03-01' }) },
  assignments: []
}, 'rehydration preserves metadata and collection state together');

const assignments = [
  { id: 1, row_id: 44, owner_company: 'Gloria Jeans', owner_group: '', owner_type: 'Brand', collection_name: 'Denim', created_by: 'user-1' },
  { id: 2, row_id: 44, owner_company: 'Gloria Jeans', owner_group: 'Boys 13+', owner_type: 'Brand', collection_name: 'Party', created_by: 'user-2' },
  { id: 3, row_id: 45, owner_company: 'STW', owner_group: '', owner_type: 'Supplier', collection_name: 'Supplier Capsule', created_by: 'supplier-1', extra_column: 'kept' }
];
state.setAssignments(assignments);
assert.deepStrictEqual(state.getAssignments(), assignments, 'assignment hydration preserves exact row shape and order');
assert.deepStrictEqual(state.getAssignmentsForStyle(44), assignments.slice(0, 2), 'getAssignmentsForStyle supports one style in multiple collections');
assert.deepStrictEqual(state.getAssignmentsForCollection('Supplier Capsule'), [assignments[2]], 'getAssignmentsForCollection supports supplier collections');
const assignmentCopy = state.getAssignments();
assignmentCopy.pop();
assert.strictEqual(state.getAssignments().length, 3, 'getAssignments returns a defensive array copy');
assert.strictEqual(state.hasAssignment(a => a.row_id === 44 && a.collection_name === 'Denim'), true, 'hasAssignment supports predicate checks');
assert.strictEqual(state.addAssignment(assignments[0], a => a.row_id === 44 && a.collection_name === 'Denim'), false, 'addAssignment rejects duplicates with injected matcher');
assert.strictEqual(state.addAssignment({ row_id: 46, owner_company: 'Gloria Jeans', owner_group: '', owner_type: 'Brand', collection_name: 'Denim', created_by: 'user-1' }, a => a.row_id === 46 && a.collection_name === 'Denim'), true, 'addAssignment stores new style assignment');
state.removeAssignment(a => a.row_id === 44 && a.collection_name === 'Denim');
assert.deepStrictEqual(state.getAssignmentsForStyle(44).map(a => a.collection_name), ['Party'], 'removeAssignment removes one collection while preserving another');
state.removeAssignmentsWhere(a => a.owner_company === 'Gloria Jeans' && a.owner_group === 'Boys 13+' && a.collection_name === 'Party');
assert.strictEqual(state.getAssignmentsForCollection('Party').length, 0, 'removeAssignmentsWhere supports collection delete cleanup');
state.removeAssignmentsWhere(a => [45, 999].indexOf(parseInt(a.row_id)) >= 0);
assert.strictEqual(state.getAssignments().some(a => parseInt(a.row_id) === 45), false, 'removeAssignmentsWhere supports style delete cleanup');
state.reset({ assignments: assignments.slice(0, 1), collectionMeta: {}, collections: [] });
assert.deepStrictEqual(state.getAssignments(), assignments.slice(0, 1), 'reset hydrates assignments');
state.resetAssignments();
assert.deepStrictEqual(state.getAssignments(), [], 'resetAssignments clears hydrated assignments');

console.log('collections state characterization ok 49');
