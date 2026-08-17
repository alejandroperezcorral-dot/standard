const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('index.html', 'utf8');
const runtime = fs.readFileSync('src/features/styles/styleCreationRuntime.js', 'utf8');

function assertOrder(source, labels) {
  let cursor = -1;
  for (const label of labels) {
    const next = source.indexOf(label);
    assert(next > cursor, `${label} should appear after the previous sidebar item`);
    cursor = next;
  }
}

assertOrder(html, ['id="side-explore"', 'id="side-styles"', 'id="side-collections"']);
assert(html.includes('#side-styles{order:20}'), 'My Styles should have a stable sidebar order immediately after Explore');
assert(html.includes('id="side-styles"'), 'My Styles sidebar button should exist');
assert(html.includes("['side-styles','styles']"), 'My Styles should be normalized by the central sidebar icon system');
assert(html.includes("styles:'<svg'+common+'><path d=\"M8 4h8l2.5 4"), 'My Styles icon should be the garment icon, not a document/placeholder');
assert(!html.includes('id="side-styles" onclick="goTab(\'styles\')" title="My Styles"><span>*</span>'), 'My Styles placeholder icon must not return');

assert(runtime.includes('collections-tabs'), 'My Styles tabs should keep the existing tab language in this scoped identity release');
assert(runtime.includes('class="on">Created'), 'Created tab should remain the active tab');
assert(runtime.includes('style-card my-style-card'), 'My Styles cards should reuse shared style-card styling');
assert(runtime.includes('style-img'), 'My Styles cards should use shared image container');
assert(runtime.includes('style-body'), 'My Styles cards should use shared card body');
assert(runtime.includes('data-style-id'), 'My Styles cards should carry the canonical style id');
assert(runtime.includes('canonicalId=style.id||style.style_id'), 'Canonical style id should be preferred over legacy row id');
assert(runtime.includes("openStyleDetail({styleId:style.id,canonicalStyle:style,workspace:'my-styles'})"), 'My Styles should open product detail with canonical identity');
assert(!runtime.includes('openStyleDetail(row.id)'), 'My Styles should no longer bounce canonical styles back through row.id');

const openStyleStart = runtime.indexOf('function openStyle(id)');
const openStyleEnd = runtime.indexOf('function openStyleFromKey', openStyleStart);
assert(openStyleStart >= 0 && openStyleEnd > openStyleStart, 'openStyle and keyboard handler should remain adjacent and inspectable');
const openStyleBody = runtime.slice(openStyleStart, openStyleEnd);
assert(!openStyleBody.includes('openStyleChat'), 'My Styles card click must not open chat');
assert(openStyleBody.includes('findCreatedStyle'), 'My Styles should resolve the canonical style object first');
assert(openStyleBody.includes("workspace:'my-styles'"), 'My Styles product detail calls should identify their workspace');
assert(runtime.includes('openStyleFromKey:openStyleFromKey'), 'Keyboard card activation should be exported');

console.log('myStylesWorkspace characterization PASS');
