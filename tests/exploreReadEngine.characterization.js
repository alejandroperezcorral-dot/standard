const fs = require('fs');
const vm = require('vm');

vm.runInThisContext(fs.readFileSync('src/features/explore/exploreModel.js', 'utf8'));
vm.runInThisContext(fs.readFileSync('src/features/explore/exploreState.js', 'utf8'));
vm.runInThisContext(fs.readFileSync('src/features/explore/exploreReadEngine.js', 'utf8'));
vm.runInThisContext(fs.readFileSync('src/features/explore/index.js', 'utf8'));

const ids = rows => rows.map(row => row.id).join(',');
const norm = value => String(value || '').trim().toLowerCase();

const baseRows = [
  { id: 1, modelo: 'BJN018700', desc: 'Barrel Colour Denim Pant', supplier: 'STW', cat: 'Pants', origin: 'Bangladesh', colour: 'Brown', dept: 'Menswear', temporada: 'SS27', status: 'CLOSED', source: 'BUYER', notes: 'Supplier ref: AAA', fob1: 7.45 },
  { id: 2, modelo: 'BJC003090', desc: 'Zip Trucker Denim Colour', supplier: 'STW', cat: 'Jackets', origin: 'China', colour: 'Red', dept: 'Menswear', temporada: 'SS27', status: 'PENDING', source: 'SUPPLIER', notes: '[SOURCE:SUPPLIER] Fabric ref: BBB', fob1: 8 },
  { id: 3, modelo: 'NA-OS-604', desc: 'Technical Overshirt', supplier: 'NOVA APPAREL', cat: 'Overshirts', origin: 'India', colour: 'Olive', dept: 'Menswear', temporada: 'SS27', status: 'PENDING', product_source: 'SUPPLIER', notes: 'Lead time' },
  { id: 4, modelo: 'BBT004454', desc: 'Pleated Balloon Tailoring Pants', supplier: '', cat: '', origin: '', colour: '', dept: '', temporada: '', status: null, source: 'BUYER', notes: '' },
  { id: 5, modelo: 'BKT019277', desc: 'Pink Wash Tee', supplier: 'STARTEX CLOTHING', cat: 'T-Shirts', origin: 'Turkey', colour: 'Pink', dept: 'Womenswear', temporada: 'SS26', status: 'CLOSED', source: 'SUPPLIER', notes: '[SOURCE:SUPPLIER] shared' },
  { id: 5, modelo: 'BKT019277-DUP', desc: 'Duplicate overlap', supplier: 'STARTEX CLOTHING', cat: 'T-Shirts', origin: 'Turkey', colour: 'Pink', dept: 'Womenswear', temporada: 'SS26', status: 'CLOSED', source: 'SUPPLIER', notes: '[SOURCE:SUPPLIER] duplicate' }
];

function sourceLabel(row) {
  const notes = String(row && row.notes || '');
  const match = notes.match(/\[SOURCE:([A-Z]+)\]/);
  return (row && row.source) || (row && row.product_source) || (match ? match[1] : 'BUYER');
}
function rowStatus(row) {
  return row && row.status === 'CLOSED' ? 'CLOSED' : 'PENDING';
}
function styleSupplierRef(row) {
  const match = String(row && row.notes || '').match(/Supplier ref: ([A-Z]+)/);
  return match ? match[1] : '';
}
function styleFabricRef(row) {
  const match = String(row && row.notes || '').match(/Fabric ref: ([A-Z]+)/);
  return match ? match[1] : '';
}
function baseNotes(notes) {
  return String(notes || '').replace(/\n?\[(CHAT|FILES|COLLECTIONS|BRAND_COLLECTIONS|SUPPLIER_REF|FABRIC_REF|SHARED_BRANDS|SHARED_BRANDS_TEXT|SOURCE):[\s\S]*?\]/g, '').trim();
}

function makeContext(overrides) {
  const collectionMap = Object.assign({
    1: [],
    2: ['Denim Colour'],
    3: ['Supplier Showroom'],
    4: ['No name'],
    5: ['Party Collection', 'Supplier Showroom']
  }, overrides && overrides.collectionMap || {});
  const accessible = Object.assign({ 1: true, 2: true, 3: true, 4: true, 5: true }, overrides && overrides.accessible || {});
  const ownedBySupplier = Object.assign({ 1: false, 2: true, 3: true, 4: false, 5: false }, overrides && overrides.ownedBySupplier || {});
  const shared = Object.assign({ 1: false, 2: true, 3: true, 4: false, 5: true }, overrides && overrides.shared || {});
  const identity = Object.assign({
    loggedIn: true,
    hasAuthProfile: true,
    adminBypass: false,
    adminViewActive: false,
    supplierUser: false,
    role: 'brand'
  }, overrides && overrides.identity || {});
  const filters = Object.assign({
    search: '',
    supplier: '',
    season: '',
    department: '',
    status: '',
    category: '',
    origin: '',
    source: '',
    collectionsView: false,
    activeCollection: '',
    savedOnly: false,
    savedIds: []
  }, overrides && overrides.filters || {});
  return {
    rows: (overrides && overrides.rows) || baseRows.slice(),
    state: Object.assign({}, filters, identity),
    context: {
      rowStatus,
      sourceLabel,
      styleSharedWithActiveCompany: row => !!shared[row && row.id],
      canAccessRowForCurrentUser: row => {
        if (identity.adminBypass && !identity.adminViewActive) return true;
        if (identity.supplierUser) return !!ownedBySupplier[row && row.id];
        return accessible[row && row.id] !== false;
      },
      currentStyleCollections: row => collectionMap[row && row.id] || [],
      styleAssignedToCurrentBrandCollection: row => !identity.supplierUser && (collectionMap[row && row.id] || []).length > 0,
      styleSupplierRef,
      styleFabricRef,
      showroomFolderName: row => (collectionMap[row && row.id] || []).join(', ') || 'No collection',
      baseNotes
    }
  };
}

function oldShowroomRows(input) {
  const state = input.state;
  const ctx = input.context;
  const q = String(state.search || '').toLowerCase();
  const fs = state.supplier, fse = state.season, fd = state.department, fst = state.status, fc = state.category, fo = state.origin;
  return input.rows.filter(function(r) {
    const st = ctx.rowStatus(r);
    ctx.styleSharedWithActiveCompany(r);
    if (state.hasAuthProfile && (!state.adminBypass || state.adminViewActive) && !ctx.canAccessRowForCurrentUser(r)) return false;
    if (!state.loggedIn) {
      if (ctx.sourceLabel(r) !== 'SUPPLIER') return false;
    }
    if (fst && st !== fst) return false;
    if (state.source && ctx.sourceLabel(r) !== state.source) return false;
    const active = state.activeCollection;
    if (state.collectionsView && active && ctx.currentStyleCollections(r).indexOf(active) < 0) return false;
    if (state.savedOnly && state.savedIds.indexOf(parseInt(r.id)) < 0) return false;
    if (fs && (r.supplier || '') !== fs) return false;
    if (fse && (r.temporada || '') !== fse) return false;
    if (fd && (r.dept || '') !== fd) return false;
    if (fc && (r.cat || '') !== fc) return false;
    if (fo && (r.origin || '') !== fo) return false;
    if (q && [r.modelo, ctx.styleSupplierRef(r), ctx.styleFabricRef(r), r.desc, r.supplier, r.cat, r.origin, r.colour, r.dept, r.temporada, ctx.showroomFolderName(r), ctx.rowStatus(r), ctx.baseNotes(r.notes)].join(' ').toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
}

function newShowroomRows(input) {
  return ExploreDomain.visibleRows({
    rows: input.rows,
    state: ExploreDomain.createReadState(input.state),
    context: input.context
  });
}

const scenarios = [
  ['Default Explore', makeContext()],
  ['Empty ROWS', makeContext({ rows: [] })],
  ['Single style', makeContext({ rows: [baseRows[0]] })],
  ['Multiple styles', makeContext()],
  ['Brand user', makeContext({ identity: { role: 'brand' } })],
  ['Supplier user', makeContext({ identity: { supplierUser: true, role: 'supplier' } })],
  ['Company Admin', makeContext({ identity: { role: 'company-admin' } })],
  ['Platform Admin', makeContext({ identity: { adminBypass: true, role: 'admin' } })],
  ['Platform Admin view-as Brand', makeContext({ identity: { adminBypass: true, adminViewActive: true, role: 'admin-view-brand' } })],
  ['Platform Admin view-as Supplier', makeContext({ identity: { adminBypass: true, adminViewActive: true, supplierUser: true, role: 'admin-view-supplier' } })],
  ['Accessible supplier style', makeContext({ filters: { source: 'SUPPLIER' } })],
  ['Inaccessible supplier style', makeContext({ accessible: { 3: false }, filters: { source: 'SUPPLIER' } })],
  ['Supplier-owned style', makeContext({ identity: { supplierUser: true }, filters: { source: 'SUPPLIER' } })],
  ['Shared supplier style', makeContext({ shared: { 3: true }, filters: { source: 'SUPPLIER' } })],
  ['Saved style', makeContext({ filters: { savedOnly: true, savedIds: [1, 3] } })],
  ['Unsaved style', makeContext({ filters: { savedOnly: true, savedIds: [99] } })],
  ['Style already in collection', makeContext({ collectionMap: { 1: ['Denim Colour'] } })],
  ['Style in multiple collections', makeContext({ filters: { collectionsView: true, activeCollection: 'Party Collection' } })],
  ['Department filter', makeContext({ filters: { department: 'Menswear' } })],
  ['Category filter', makeContext({ filters: { category: 'Overshirts' } })],
  ['Supplier filter', makeContext({ filters: { supplier: 'NOVA APPAREL' } })],
  ['Origin filter', makeContext({ filters: { origin: 'India' } })],
  ['Source filter', makeContext({ filters: { source: 'BUYER' } })],
  ['Status filter where applicable', makeContext({ filters: { status: 'CLOSED' } })],
  ['Search', makeContext({ filters: { search: 'technical' } })],
  ['Combined filters', makeContext({ filters: { source: 'SUPPLIER', department: 'Menswear', origin: 'India', search: 'overshirt' } })],
  ['No matching results', makeContext({ filters: { search: 'does-not-exist' } })],
  ['Missing supplier', makeContext({ filters: { supplier: '' }, collectionMap: { 4: [] } })],
  ['Missing origin', makeContext({ filters: { origin: '' }, collectionMap: { 4: [] } })],
  ['Missing category', makeContext({ filters: { category: '' }, collectionMap: { 4: [] } })],
  ['Missing metadata', makeContext({ rows: [{ id: 10 }] })],
  ['Legacy source/product_source values', makeContext({ rows: [{ id: 11, product_source: 'SUPPLIER', notes: '' }, { id: 12, notes: '[SOURCE:SUPPLIER]' }], identity: { loggedIn: false, hasAuthProfile: false } })],
  ['Random/default ordering behavior', makeContext({ rows: [baseRows[4], baseRows[0], baseRows[2], baseRows[1]], collectionMap: { 1: [], 2: [], 3: [], 5: [] } })],
  ['Reset filters', makeContext({ filters: { search: '', supplier: '', season: '', department: '', status: '', category: '', origin: '', source: '', savedOnly: false } })],
  ['Explore after Collections navigation', makeContext({ filters: { collectionsView: false, activeCollection: 'Denim Colour' } })],
  ['Company switch', makeContext({ accessible: { 1: false, 2: false, 3: true, 4: false, 5: false } })],
  ['Group context', makeContext({ filters: { collectionsView: true, activeCollection: 'Denim Colour' } })],
  ['Supplier sharing access', makeContext({ filters: { source: 'SUPPLIER' }, shared: { 2: true, 3: false, 5: true } })],
  ['Saved-only behavior if currently supported', makeContext({ filters: { savedOnly: true, savedIds: [2, 5] } })],
  ['Duplicate/overlapping row scenarios', makeContext({ rows: [baseRows[4], baseRows[5]], collectionMap: { 5: [] } })]
];

scenarios.forEach(([label, input]) => {
  const oldRows = oldShowroomRows(input);
  const newRows = newShowroomRows(input);
  if (ids(oldRows) !== ids(newRows)) {
    throw new Error(label + ' mismatch: ' + ids(oldRows) + ' !== ' + ids(newRows));
  }
});

{
  const input = makeContext({
    rows: [baseRows[1]],
    collectionMap: { 2: ['Collection A', 'Collection B', 'Collection C'] },
    filters: { collectionsView: false }
  });
  const rows = newShowroomRows(input);
  if (ids(rows) !== '2') {
    throw new Error('Collected style must remain visible once in default Explore; got ' + ids(rows));
  }
}

{
  const input = makeContext({
    rows: [baseRows[1], baseRows[2]],
    collectionMap: { 2: ['Collection A', 'Collection B'], 3: ['Collection C'] },
    filters: { collectionsView: true, activeCollection: 'Collection B' }
  });
  const rows = newShowroomRows(input);
  if (ids(rows) !== '2') {
    throw new Error('Explicit Collections view must still filter by collection; got ' + ids(rows));
  }
}

{
  const input = makeContext({
    rows: [baseRows[1]],
    collectionMap: { 2: ['Collection A'] },
    accessible: { 2: false },
    filters: { collectionsView: false }
  });
  const rows = newShowroomRows(input);
  if (rows.length !== 0) {
    throw new Error('Inaccessible collected style must not become visible in Explore.');
  }
}

console.log('explore read engine characterization ok ' + scenarios.length);
