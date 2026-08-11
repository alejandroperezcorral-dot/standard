const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

vm.runInThisContext(fs.readFileSync('src/features/collections/collectionRenderer.js', 'utf8'));

function escHtml(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function norm(v) { return String(v || '').trim().toLowerCase(); }
function fN(v) { return Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }); }
function fP(v) { return Number(v || 0).toFixed(1) + '%'; }
function fU(v) { return '$' + Number(v || 0).toFixed(2); }
function helpers() {
  return {
    escHtml,
    normalizeName: norm,
    formatNumber: fN,
    formatPercent: fP,
    formatUsd: fU,
    statusDot: status => '<i class="' + status + '"></i>',
    rowStatus: row => row.status || 'PENDING'
  };
}

const groupOptions = CollectionRenderer.adminGroupOptions({
  groups: [{ name: 'Boys 13+' }, { name: 'Girls & Kids' }],
  selected: 'boys 13+',
  helpers: helpers()
});
assert(groupOptions.includes('<option value="">Private collection</option>'), 'renders private collection option');
assert(groupOptions.includes('value="Boys 13+" selected'), 'selects matching group');
assert(groupOptions.includes('Girls &amp; Kids'), 'escapes group label');

const mineTabs = CollectionRenderer.scopeTabs({ scope: 'mine', groups: ['Boys 13+'], groupFilters: [], helpers: helpers() });
assert(mineTabs.includes('setCollectionsScope(\'mine\')'), 'keeps mine tab handler');
assert(mineTabs.includes('class="on"'), 'marks active personal collections tab');
assert(!mineTabs.includes('collections-group-filters'), 'does not render group filters on mine scope');

const groupTabs = CollectionRenderer.scopeTabs({ scope: 'groups', groups: ['Boys 13+', 'Girls 13+'], groupFilters: ['Girls 13+'], helpers: helpers() });
assert(groupTabs.includes('My Groups Collections'), 'renders group collections tab');
assert(groupTabs.includes('toggleCollectionGroupFilter'), 'keeps group filter handler');
assert(groupTabs.includes('value="Girls 13+" checked'), 'checks selected group filter');
assert(!groupTabs.includes('value="Boys 13+" checked'), 'does not check unselected group when filters exist');

const emptyGroupTabs = CollectionRenderer.scopeTabs({ scope: 'groups', groups: [], groupFilters: [], helpers: helpers() });
assert(emptyGroupTabs.includes('No groups assigned yet'), 'renders empty group message');

const filtersClosed = CollectionRenderer.filters({
  years: ['2026', '2027'],
  year: '2026',
  monthFrom: 1,
  monthTo: 12,
  advancedOpen: false,
  companies: [],
  groups: [],
  helpers: helpers()
});
assert(filtersClosed.includes('aria-label="Collection year"'), 'renders year select');
assert(filtersClosed.includes('value="2026" selected'), 'selects current year');
assert(filtersClosed.includes('title="Advanced filters"'), 'renders advanced filter icon button');
assert(!filtersClosed.includes('collections-advanced-filters'), 'hides advanced filters when closed');

const filtersOpen = CollectionRenderer.filters({
  years: ['2026'],
  year: '',
  monthFrom: 9,
  monthTo: 3,
  advancedOpen: true,
  companies: ['Gloria Jeans'],
  groups: ['Boys 13+'],
  companyFilter: 'Gloria Jeans',
  groupFilter: 'Boys 13+',
  helpers: helpers()
});
assert(filtersOpen.includes('Mar - Sep'), 'normalizes month range label');
assert(filtersOpen.includes('left:18.181818181818183%;right:27.272727272727266%'), 'preserves month fill calculation');
assert(filtersOpen.includes('All brand companies'), 'renders company filter');
assert(filtersOpen.includes('value="Boys 13+" selected'), 'selects group filter');
assert(filtersOpen.includes('Clear advanced'), 'keeps clear action');

const options = CollectionRenderer.collectionOptions({
  values: ['Clubhouse'],
  current: 'Denim',
  label: 'No collection',
  helpers: helpers()
});
assert(options.indexOf('value="Denim" selected') < options.indexOf('value="Clubhouse"'), 'prepends current value missing from options');

const card = CollectionRenderer.boardCard({
  ref: 'Brand::Gloria Jeans::Boys 13+::Denim & Colour',
  meta: { fsd: '2026-12-23', owner_company: 'Gloria Jeans', owner_group: 'Boys 13+' },
  display: 'Denim & Colour',
  rows: [{ id: 1 }, { id: 2 }],
  images: ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg'],
  summary: { units: 18400, imu: 73.5 },
  creator: 'buyer@example.com',
  helpers: helpers()
});
assert(card.includes('class="collection-card"'), 'renders collection card button');
assert(card.includes('mosaic-4'), 'renders four-image mosaic');
assert(card.includes('openCollectionBoard(&quot;Brand::Gloria Jeans::Boys 13+::Denim & Colour&quot;)'), 'keeps escaped open handler');
assert(card.includes('Denim &amp; Colour'), 'escapes collection display');
assert(card.includes('2 styles - FSD 2026-12-23 - Gloria Jeans - Boys 13+'), 'renders count, FSD, company and group');
assert(card.includes('Created by buyer@example.com'), 'renders creator email');
assert(card.includes('<b>18,400</b>'), 'renders collection units');
assert(card.includes('<b>73.5%</b>'), 'renders collection IMU');

const emptyCard = CollectionRenderer.boardCard({
  ref: 'Empty',
  meta: {},
  display: 'Empty',
  rows: [],
  images: [],
  summary: { units: 0, imu: 0 },
  creator: '',
  helpers: helpers()
});
assert(emptyCard.includes('mosaic-0'), 'keeps empty mosaic class');
assert(emptyCard.includes('<span></span>'), 'renders placeholder span for empty collection');
assert(emptyCard.includes('0 styles'), 'renders empty count');

const header = CollectionRenderer.detailHeader({
  folderName: 'Party Collection',
  count: 1,
  fsdText: ' - FSD 2026-12-23',
  summary: { units: 1200, imu: 68.25 },
  supplierCanShare: true,
  canRemove: true,
  helpers: helpers()
});
assert(header.includes('backToCollectionsBoard()'), 'keeps back handler');
assert(header.includes('1 style in this board - FSD 2026-12-23'), 'renders singular count and FSD');
assert(header.includes('shareCurrentCollection()'), 'renders supplier share action');
assert(header.includes('openEditCollectionModal()'), 'renders edit action');
assert(header.includes('removeCurrentCollection()'), 'renders remove action');
assert(header.includes('Total units'), 'renders detail stat labels');

assert(CollectionRenderer.emptyState('first').includes('Create your first collection'), 'renders first collection CTA');
assert(CollectionRenderer.emptyState('detail').includes('showroomExploreAll()'), 'renders empty detail Explore CTA');
assert(CollectionRenderer.emptyState('period').includes('No collections have an FSD inside this period.'), 'renders period empty state');

const styleCard = CollectionRenderer.detailStyleCard({
  row: { id: 7, modelo: 'BJN018700', desc: 'Barrel pant', supplier: 'STW', fob1: 7.45, status: 'CLOSED' },
  calculations: {},
  image: 'pant.jpg',
  sourceLabel: 'BUYER',
  supplierRef: 'SUP-1',
  pinHeight: 248,
  selected: true,
  loggedIn: true,
  folderName: 'Denim Colour',
  helpers: helpers()
});
assert(styleCard.includes('openStyleDetail(7)'), 'keeps style open handler');
assert(styleCard.includes('data-id="7" checked'), 'renders selected checkbox');
assert(styleCard.includes('height:248px'), 'preserves supplied masonry height');
assert(styleCard.includes('Supplier ref: SUP-1'), 'renders supplier reference');
assert(styleCard.includes('<b>$7.45</b>'), 'renders FOB when logged in');

const publicStyleCard = CollectionRenderer.detailStyleCard({
  row: { id: 8, modelo: '', desc: '', supplier: '', status: 'PENDING' },
  image: '',
  sourceLabel: 'SUPPLIER',
  loggedIn: false,
  folderName: '',
  helpers: helpers()
});
assert(publicStyleCard.includes('NO STYLE'), 'renders fallback style name');
assert(publicStyleCard.includes('No supplier'), 'renders fallback supplier');
assert(!publicStyleCard.includes('sh-sel'), 'hides checkbox for logged out users');
assert(publicStyleCard.includes('<svg width="44" height="44"'), 'renders no-image placeholder');

console.log('collections rendering characterization ok 42');
