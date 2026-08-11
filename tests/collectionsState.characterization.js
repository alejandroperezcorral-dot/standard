const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

vm.runInThisContext(fs.readFileSync('src/features/collections/collectionState.js', 'utf8'));

const state = createCollectionState();
assert.deepStrictEqual(state.snapshot(), { scope: 'mine', groupFilters: [] }, 'initial state matches legacy collections scope');

assert.strictEqual(state.setScope('groups'), 'groups', 'sets group scope');
assert.deepStrictEqual(state.snapshot(), { scope: 'groups', groupFilters: [] }, 'scope change does not add filters');

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
assert.deepStrictEqual(state.snapshot(), { scope: 'groups', groupFilters: ['Denim'] }, 'reset hydrates a known state');

state.reset();
assert.deepStrictEqual(state.snapshot(), { scope: 'mine', groupFilters: [] }, 'reset without args returns initial state');

assert.deepStrictEqual(CollectionState.snapshot(), { scope: 'mine', groupFilters: [] }, 'default singleton starts with legacy state');

console.log('collections state characterization ok 11');
