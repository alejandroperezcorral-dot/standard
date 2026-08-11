const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('index.html', 'utf8');
const collectionRepository = fs.readFileSync('src/features/collections/collectionRepository.js', 'utf8');
const collectionService = fs.readFileSync('src/features/collections/collectionService.js', 'utf8');

function functionBody(name) {
  const start = html.indexOf(`function ${name}(`) >= 0
    ? html.indexOf(`function ${name}(`)
    : html.indexOf(`async function ${name}(`);
  assert(start >= 0, `${name} exists`);
  const next = html.indexOf('\nfunction ', start + 1);
  const nextAsync = html.indexOf('\nasync function ', start + 1);
  const candidates = [next, nextAsync].filter(i => i > start);
  const end = candidates.length ? Math.min.apply(null, candidates) : html.length;
  return html.slice(start, end);
}

const styleDependencyDelete = functionBody('sbDeleteStyleDependencies');
assert(styleDependencyDelete.includes("style_collection_assignments"), 'style delete still removes collection assignments');
assert(!/figma/i.test(styleDependencyDelete), 'style dependency delete has no Figma dependency');

const deletedStyleCleanup = functionBody('cleanupDeletedStyleReferences');
assert(deletedStyleCleanup.includes('cleanupRemovedStyles'), 'style delete still cleans local rows');
assert(deletedStyleCleanup.includes('SHOWROOM_COLLECTION_ASSIGNMENTS'), 'style delete still cleans local collection assignments');
assert(deletedStyleCleanup.includes('loadCanvases'), 'style delete still checks Canvas catalog');
assert(deletedStyleCleanup.includes('linked_style_id'), 'style delete still removes linked Canvas style items');
assert(deletedStyleCleanup.includes('persistCanvases'), 'style delete still persists Canvas cleanup');
assert(!/figma/i.test(deletedStyleCleanup), 'local style cleanup has no Figma dependency');

const collectionDelete = functionBody('deleteCompanyCollectionExplicit');
[
  'SHOWROOM_COLLECTION_META',
  'SHOWROOM_COLLECTIONS',
  'SHOWROOM_COLLECTION_ASSIGNMENTS',
  'setStyleMeta',
  'styleBrandCollectionMap',
  'styleCollections'
].forEach(token => assert(collectionDelete.includes(token), `collection delete still includes ${token}`));
assert(!/figma/i.test(collectionDelete), 'collection delete has no Figma dependency');

[
  'deleteStyleAssignmentsForCollection',
  'deleteScopedCollectionById',
  'deleteScopedCollectionByFilters',
  'selectScopedCollectionById',
  'selectScopedCollectionByFilters',
  'Collection was not deleted from database'
].forEach(token => assert(collectionService.includes(token), `collection delete service still includes ${token}`));
[
  'style_collection_assignments',
  'showroom_collections_scoped'
].forEach(token => assert(collectionRepository.includes(token), `collection repository still includes ${token}`));
assert(!/figma/i.test(collectionService), 'collection service has no Figma dependency');
assert(!/figma/i.test(collectionRepository), 'collection repository has no Figma dependency');

[
  'collectionFigmaKey',
  'figmaConnectionForCollection',
  'figmaSyncStatus',
  'styleFigmaSnapshot',
  'loadFigmaConnections',
  'parseFigmaIds',
  'openFigmaConnectModal',
  'closeFigmaConnectModal',
  'saveFigmaConnection',
  'openCurrentCollectionInFigma',
  'disconnectCurrentCollectionFigma',
  'syncCurrentCollectionFigma'
].forEach(name => assert(!html.includes(name), `${name} removed`));

assert(!/sb\.from\(['"]figma_/i.test(html), 'no runtime Supabase Figma table access remains');
assert(!/Connect to Figma|Sync collection|Open in Figma|One collection\. Always updated in STDTEX and Figma/i.test(html), 'no deprecated Figma UI copy remains');

console.log('figma removal delete characterization ok 18');
