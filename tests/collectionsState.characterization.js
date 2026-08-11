const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

vm.runInThisContext(fs.readFileSync('src/features/collections/collectionState.js', 'utf8'));

const state = createCollectionState();
assert.deepStrictEqual(state.snapshot(), { scope: 'mine', groupFilters: [], collections: [] }, 'initial state matches legacy collections scope');

assert.strictEqual(state.setScope('groups'), 'groups', 'sets group scope');
assert.deepStrictEqual(state.snapshot(), { scope: 'groups', groupFilters: [], collections: [] }, 'scope change does not add filters');

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
assert.deepStrictEqual(state.snapshot(), { scope: 'groups', groupFilters: ['Denim'], collections: [] }, 'reset hydrates a known state');

state.reset();
assert.deepStrictEqual(state.snapshot(), { scope: 'mine', groupFilters: [], collections: [] }, 'reset without args returns initial state');

assert.deepStrictEqual(CollectionState.snapshot(), { scope: 'mine', groupFilters: [], collections: [] }, 'default singleton starts with legacy state');

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
assert.deepStrictEqual(state.snapshot(), { scope: 'groups', groupFilters: ['Denim'], collections: ['Z', 'Y'] }, 'reset hydrates collections without sorting');

console.log('collections state characterization ok 22');
