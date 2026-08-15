const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

[
  'src/core/permissions.js',
  'src/features/styles/styleModel.js',
  'src/features/styles/styleCreationModel.js',
  'src/features/styles/styleRepository.js',
  'src/features/styles/styleService.js',
  'src/features/styles/index.js',
  'src/features/explore/exploreModel.js',
  'src/features/explore/exploreState.js',
  'src/features/explore/exploreReadEngine.js',
  'src/features/explore/index.js',
  'src/features/collections/collectionModel.js',
  'src/features/collections/collectionRepository.js',
  'src/features/collections/collectionService.js',
  'src/features/collections/collectionRenderer.js',
  'src/features/collections/collectionState.js',
  'src/features/collections/index.js'
].forEach(file => vm.runInThisContext(fs.readFileSync(file, 'utf8')));

const knownConflicts = [];

function knownConflict(code, condition, detail) {
  assert(condition, code + ' is no longer characterized as a current conflict; update this test to assert the approved rule directly.');
  knownConflicts.push({ code, detail });
}

function makeCollectionRepo() {
  const calls = [];
  return {
    calls,
    upsertStyleAssignment(row) {
      calls.push({ op: 'upsertStyleAssignment', row: Object.assign({}, row) });
      return Promise.resolve({ error: null });
    },
    deleteStyleAssignment(scope, rowId, collectionName) {
      calls.push({ op: 'deleteStyleAssignment', scope: Object.assign({}, scope), rowId, collectionName });
      return Promise.resolve({ error: null });
    }
  };
}

(async function run() {
  const supplierStyle = StylesDomain.fromNegotiationRow({
    id: 123,
    modelo: 'SUP-123',
    description: 'Supplier master style',
    supplier: 'STW',
    origin: 'Bangladesh',
    colour: 'Black',
    status: 'PENDING',
    notes: '[SOURCE:SUPPLIER][SUPPLIER_REF:SUP-REF-123][FABRIC_REF:FAB-456]',
    user_id: 'supplier-user'
  });

  assert.strictEqual(supplierStyle.id, 123, 'Style identity must come from negotiation_rows.id');
  assert.strictEqual(StylesDomain.isSupplierShowroom(supplierStyle), true, 'Supplier source must be detected from notes');
  assert.strictEqual(StylesDomain.source(supplierStyle), 'SUPPLIER', 'Supplier source label must be preserved');
  assert.strictEqual(StylesDomain.supplierReference(supplierStyle), 'SUP-REF-123', 'Supplier reference must be read from lifecycle metadata');
  assert.strictEqual(StylesDomain.fabricReference(supplierStyle), 'FAB-456', 'Fabric reference must be read from lifecycle metadata');

  assert.strictEqual(canDeleteStyleForUser(true, 'admin-user', 'supplier-user'), true, 'Platform Admin can delete styles');
  assert.strictEqual(canDeleteStyleForUser(false, 'supplier-user', 'supplier-user'), true, 'Owner can delete own style under existing permissions');
  assert.strictEqual(canDeleteStyleForUser(false, 'brand-user', 'supplier-user'), false, 'Unauthorized Brand cannot delete Supplier style');

  const collectionState = createCollectionState({
    assignments: [
      { row_id: 123, owner_company: 'Gloria Jeans', owner_group: 'Boys 13+', owner_type: 'Brand', collection_name: 'Collection A', created_by: 'brand-a' },
      { row_id: 123, owner_company: 'Gloria Jeans', owner_group: 'Boys 13+', owner_type: 'Brand', collection_name: 'Collection B', created_by: 'brand-a' },
      { row_id: 123, owner_company: 'Another Brand', owner_group: '', owner_type: 'Brand', collection_name: 'Selection', created_by: 'brand-b' }
    ]
  });

  assert.deepStrictEqual(
    collectionState.getAssignmentsForStyle(123).map(a => a.collection_name).sort(),
    ['Collection A', 'Collection B', 'Selection'],
    'One Style ID can be referenced by multiple collection relationships in state'
  );

  collectionState.removeAssignmentsWhere(a => a.collection_name === 'Collection A');
  assert.deepStrictEqual(
    collectionState.getAssignmentsForStyle(123).map(a => a.collection_name).sort(),
    ['Collection B', 'Selection'],
    'Removing one collection assignment must preserve other assignments for the same Style ID'
  );

  const duplicateRelationship = { row_id: 123, owner_company: 'Gloria Jeans', owner_group: 'Boys 13+', owner_type: 'Brand', collection_name: 'Collection B', created_by: 'brand-a' };
  const duplicateAdded = collectionState.addAssignment(duplicateRelationship, item =>
    String(item.row_id) === String(duplicateRelationship.row_id) &&
    item.owner_company === duplicateRelationship.owner_company &&
    item.owner_group === duplicateRelationship.owner_group &&
    item.owner_type === duplicateRelationship.owner_type &&
    item.collection_name === duplicateRelationship.collection_name
  );
  assert.strictEqual(duplicateAdded, false, 'Duplicate prevention must apply to the same Style-Collection-scope relationship');

  const newRelationshipAdded = collectionState.addAssignment(
    { row_id: 123, owner_company: 'Gloria Jeans', owner_group: 'Boys 13+', owner_type: 'Brand', collection_name: 'Collection C', created_by: 'brand-a' },
    item => item.row_id === 123 && item.owner_company === 'Gloria Jeans' && item.owner_group === 'Boys 13+' && item.owner_type === 'Brand' && item.collection_name === 'Collection C'
  );
  assert.strictEqual(newRelationshipAdded, true, 'The same Style ID must be allowed in another collection relationship');

  const canvasItem = { type: 'style', linked_style_id: supplierStyle.id };
  assert.strictEqual(canvasItem.linked_style_id, 123, 'Canvas must reference the same Style ID');

  const exploreRows = ExploreDomain.visibleRows({
    rows: [supplierStyle],
    state: ExploreDomain.createReadState({
      loggedIn: true,
      hasAuthProfile: true,
      collectionsView: false
    }),
    context: {
      rowStatus: StylesDomain.status,
      sourceLabel: StylesDomain.source,
      canAccessRowForCurrentUser: () => true,
      currentStyleCollections: () => ['Collection B'],
      styleAssignedToCurrentBrandCollection: () => true
    }
  });
  assert.strictEqual(
    exploreRows.length,
    1,
    'Collection membership alone must not remove a style from default Explore'
  );

  const repo = makeCollectionRepo();
  await CollectionsDomain.persistScopedAssignment(
    supplierStyle,
    'Collection B',
    'add',
    {
      repository: repo,
      isLoggedIn: () => true,
      collectionMetaByRef: name => ({ name, owner_company: 'Gloria Jeans', owner_group: 'Boys 13+', owner_type: 'Brand' }),
      collectionDisplayName: (name, meta) => meta.name || name,
      collectionScopeInfo: group => ({ owner_company: 'Gloria Jeans', owner_group: group || '', owner_type: 'Brand' }),
      authUser: { id: 'brand-a', email: 'buyer@gloria-jeans.com' }
    }
  );
  assert.strictEqual(
    repo.calls.some(call => call.op === 'deleteOtherStyleAssignments'),
    false,
    'Adding a style to one collection must not delete other collection assignments'
  );

  const duplicateRepo = makeCollectionRepo();
  const duplicateMessages = [];
  const duplicate = await CollectionsDomain.persistScopedAssignment(
    supplierStyle,
    'Collection B',
    'add',
    {
      repository: duplicateRepo,
      isLoggedIn: () => true,
      collectionMetaByRef: name => ({ name, owner_company: 'Gloria Jeans', owner_group: 'Boys 13+', owner_type: 'Brand' }),
      collectionDisplayName: (name, meta) => meta.name || name,
      collectionScopeInfo: group => ({ owner_company: 'Gloria Jeans', owner_group: group || '', owner_type: 'Brand' }),
      authUser: { id: 'brand-a', email: 'buyer@gloria-jeans.com' },
      assignments: [{ row_id: 123, owner_company: 'Gloria Jeans', owner_group: 'Boys 13+', owner_type: 'Brand', collection_name: 'Collection B' }],
      onDuplicateAssignment: message => duplicateMessages.push(message)
    }
  );
  assert.strictEqual(duplicate.duplicate, true, 'Duplicate add must be returned as a safe no-op');
  assert.deepStrictEqual(duplicateRepo.calls, [], 'Duplicate add must not write to the repository');
  assert.deepStrictEqual(duplicateMessages, ['This style is already in this collection.']);

  assert(
    !fs.readFileSync('index.html', 'utf8').includes('function figma') &&
    !fs.readFileSync('src/features/collections/collectionService.js', 'utf8').match(/figma/i),
    'Figma runtime code must remain absent from active collection runtime'
  );

  console.log('product rules characterization ok; known conflicts ' + knownConflicts.length);
  knownConflicts.forEach(conflict => console.log('known conflict: ' + conflict.code + ' - ' + conflict.detail));
})().catch(error => {
  console.error(error);
  process.exit(1);
});
