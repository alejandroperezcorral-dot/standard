const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const runtime = fs.readFileSync(path.join(root, 'src/features/styles/styleCreationRuntime.js'), 'utf8');

function positionOf(needle, source = html) {
  const index = source.indexOf(needle);
  assert.notStrictEqual(index, -1, `Missing expected fragment: ${needle}`);
  return index;
}

const explorePosition = positionOf('id="side-explore"');
const myStylesPosition = positionOf('id="side-styles"');
const collectionsPosition = positionOf('id="side-collections"');
assert(
  explorePosition < myStylesPosition && myStylesPosition < collectionsPosition,
  'My Styles must sit immediately after Explore and before My Collections in the left sidebar.'
);

const sideStylesButton = html.slice(myStylesPosition, collectionsPosition);
assert(sideStylesButton.includes('class="platform-side-btn pin-auth-only"'), 'My Styles must use the existing sidebar button class system.');
assert(sideStylesButton.includes('<svg viewBox="0 0 24 24"'), 'My Styles must use the same inline SVG icon system as the sidebar.');
assert(sideStylesButton.includes('stroke-width="2.2"'), 'My Styles icon stroke weight must match the sidebar visual system.');
assert(!sideStylesButton.includes('<span>*</span>'), 'My Styles must not use the placeholder asterisk icon.');

assert(runtime.includes('class="style-card my-style-card"'), 'My Styles cards must reuse the shared style-card primitive.');
assert(runtime.includes('<div class="style-img">'), 'My Styles cards must reuse the shared style image block.');
assert(runtime.includes('<div class="style-body">'), 'My Styles cards must reuse the shared style body block.');

assert(runtime.includes('data-style-id="'), 'My Styles cards must expose canonical style identity.');
assert(runtime.includes('canonicalId=style.id||style.style_id'), 'My Styles cards must prefer canonical styles.id over legacy negotiation row identity.');

const openStyleStart = positionOf('function openStyle(id)', runtime);
const openStyleEnd = positionOf('function openStyleFromKey', runtime);
const openStyleBody = runtime.slice(openStyleStart, openStyleEnd);
assert(openStyleBody.includes('openStyleDetail(row.id)'), 'My Styles click must open the existing Product Detail sidebar.');
assert(!openStyleBody.includes('openStyleChat'), 'My Styles click must not open Chat.');
assert(openStyleBody.includes('r.style_id') && openStyleBody.includes('r.canonical_style_id'), 'My Styles must resolve canonical style IDs back to their compatible row.');

const renderCardStart = positionOf('function renderCard(style)', runtime);
const renderCardEnd = positionOf('async function renderMyStylesPage', runtime);
const renderCardBody = runtime.slice(renderCardStart, renderCardEnd);
assert(renderCardBody.includes('StyleCreationRuntime.openStyle'), 'My Styles card click must be routed through the My Styles style opener.');
assert(!renderCardBody.includes('openStyleChat'), 'My Styles cards must not wire any direct Chat action.');
assert(renderCardBody.includes('openStyleFromKey'), 'My Styles cards must support keyboard activation without a separate implementation.');

assert(/onclick="showroomExploreAll\(\)">All<\/button>/.test(html), 'Explore All chip must remain unchanged.');
assert(/onclick="toggleSavedShowroomFilter\(\)">Saved<\/button>/.test(html), 'Explore Saved chip must remain unchanged.');
assert(html.includes("id=\"side-collections\" onclick=\"openManageCollections()\""), 'My Collections navigation must remain unchanged.');

console.log('myStylesWorkspace characterization PASS');
