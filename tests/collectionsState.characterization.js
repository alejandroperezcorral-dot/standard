const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

vm.runInThisContext(fs.readFileSync('src/features/collections/collectionState.js', 'utf8'));

const state = createCollectionState();
assert.deepStrictEqual(state.snapshot(), { scope: 'mine', groupFilters: [], collections: [], collectionMeta: {} }, 'initial state matches legacy collections scope');

assert.strictEqual(state.setScope('groups'), 'groups', 'sets group scope');
assert.deepStrictEqual(state.snapshot(), { scope: 'groups', groupFilters: [], collections: [], collectionMeta: {} }, 'scope change does not add filters');

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
assert.deepStrictEqual(state.snapshot(), { scope: 'groups', groupFilters: ['Denim'], collections: [], collectionMeta: {} }, 'reset hydrates a known state');

state.reset();
assert.deepStrictEqual(state.snapshot(), { scope: 'mine', groupFilters: [], collections: [], collectionMeta: {} }, 'reset without args returns initial state');

assert.deepStrictEqual(CollectionState.snapshot(), { scope: 'mine', groupFilters: [], collections: [], collectionMeta: {} }, 'default singleton starts with legacy state');

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
assert.deepStrictEqual(state.snapshot(), { scope: 'groups', groupFilters: ['Denim'], collections: ['Z', 'Y'], collectionMeta: {} }, 'reset hydrates collections without sorting');

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
  collectionMeta: { 'brand:gloria jeans::Renamed': Object.assign({}, personalMeta, { name: 'Renamed', fsd: '2027-03-01' }) }
}, 'rehydration preserves metadata and collection state together');

console.log('collections state characterization ok 36');
