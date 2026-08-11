const fs = require('fs');
const vm = require('vm');

vm.runInThisContext(fs.readFileSync('src/features/explore/exploreModel.js', 'utf8'));
vm.runInThisContext(fs.readFileSync('src/features/explore/exploreState.js', 'utf8'));
vm.runInThisContext(fs.readFileSync('src/features/explore/exploreReadEngine.js', 'utf8'));
vm.runInThisContext(fs.readFileSync('src/features/explore/index.js', 'utf8'));

function assertEqual(label, actual, expected) {
  if (actual !== expected) throw new Error(label + ': ' + actual + ' !== ' + expected);
}
function assertState(label, expected) {
  const state = ExploreDomain.state.snapshot();
  Object.keys(expected).forEach(key => assertEqual(label + ' ' + key, state[key], expected[key]));
}
function reset() {
  ExploreDomain.state.reset();
}

const scenarios = [
  ['default state', () => assertState('default', { search: '', supplier: '', season: '', department: '', status: '', category: '', origin: '', source: '', collectionsView: false, savedOnly: false })],
  ['search change', () => { ExploreDomain.state.setSearch(' Denim '); assertEqual('search', ExploreDomain.state.getSearch(), ' denim '); }],
  ['search reset', () => { ExploreDomain.state.setSearch('x'); ExploreDomain.state.resetFilters(); assertEqual('search reset', ExploreDomain.state.getSearch(), ''); }],
  ['supplier filter', () => { ExploreDomain.state.setFilter('supplier', 'STW'); assertEqual('supplier', ExploreDomain.state.getFilters().supplier, 'STW'); }],
  ['season filter', () => { ExploreDomain.state.setFilter('season', 'SS27'); assertEqual('season', ExploreDomain.state.getFilters().season, 'SS27'); }],
  ['department filter', () => { ExploreDomain.state.setFilter('department', 'Menswear'); assertEqual('department', ExploreDomain.state.getFilters().department, 'Menswear'); }],
  ['status filter', () => { ExploreDomain.state.setFilter('status', 'PENDING'); assertEqual('status', ExploreDomain.state.getFilters().status, 'PENDING'); }],
  ['category filter', () => { ExploreDomain.state.setFilter('category', 'Jackets'); assertEqual('category', ExploreDomain.state.getFilters().category, 'Jackets'); }],
  ['origin filter', () => { ExploreDomain.state.setFilter('origin', 'India'); assertEqual('origin', ExploreDomain.state.getFilters().origin, 'India'); }],
  ['source filter', () => { ExploreDomain.state.setFilter('source', 'SUPPLIER'); assertEqual('source', ExploreDomain.state.getFilters().source, 'SUPPLIER'); }],
  ['collections view', () => { ExploreDomain.state.setCollectionsView(true); assertEqual('collections view', ExploreDomain.state.getCollectionsView(), true); }],
  ['saved-only', () => { ExploreDomain.state.setSavedOnly(true); assertEqual('saved-only', ExploreDomain.state.getSavedOnly(), true); }],
  ['combined filters', () => { ExploreDomain.state.setSearch('zip'); ExploreDomain.state.setFilter('supplier', 'STW'); ExploreDomain.state.setFilter('origin', 'China'); ExploreDomain.state.setSavedOnly(true); assertState('combined', { search: 'zip', supplier: 'STW', origin: 'China', savedOnly: true }); }],
  ['reset all', () => { ExploreDomain.state.setFilter('source', 'SUPPLIER'); ExploreDomain.state.setCollectionsView(true); ExploreDomain.state.setSavedOnly(true); ExploreDomain.state.reset(); assertState('reset all', { source: '', collectionsView: false, savedOnly: false }); }],
  ['Explore page reopen', () => { EXPLORE_SEARCH = 'abc'; SHOWROOM_COLLECTIONS_VIEW = false; assertState('reopen', { search: 'abc', collectionsView: false }); }],
  ['navigation from Collections', () => { SHOWROOM_COLLECTIONS_VIEW = true; SHOWROOM_SAVED_ONLY = false; assertState('collections nav', { collectionsView: true, savedOnly: false }); }],
  ['company switch', () => { ExploreDomain.state.resetFilters(); assertState('company switch', { search: '', supplier: '', source: '' }); }],
  ['admin view-as', () => { ExploreDomain.state.setFilter('status', 'CLOSED'); assertEqual('admin view-as', ExploreDomain.state.snapshot({ adminViewActive: true }).adminViewActive, true); }],
  ['supplier user', () => { ExploreDomain.state.setFilter('source', 'SUPPLIER'); assertEqual('supplier source', SHOWROOM_SOURCE, 'SUPPLIER'); }],
  ['Brand user', () => { SHOWROOM_SOURCE = ''; assertEqual('brand source', ExploreDomain.state.getFilters().source, ''); }],
  ['empty values', () => { ExploreDomain.state.setFilter('origin', null); assertEqual('empty origin', ExploreDomain.state.getFilters().origin, ''); }],
  ['unknown values', () => { ExploreDomain.state.setFilter('category', 'Unknown'); assertEqual('unknown category', ExploreDomain.state.getFilters().category, 'Unknown'); }]
];

scenarios.forEach(([label, run]) => {
  reset();
  run();
});

console.log('explore state characterization ok ' + scenarios.length);
