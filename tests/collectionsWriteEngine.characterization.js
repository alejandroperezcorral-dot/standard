const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

vm.runInThisContext(fs.readFileSync('src/features/collections/collectionModel.js', 'utf8'));
vm.runInThisContext(fs.readFileSync('src/features/collections/collectionRepository.js', 'utf8'));
vm.runInThisContext(fs.readFileSync('src/features/collections/collectionService.js', 'utf8'));
vm.runInThisContext(fs.readFileSync('src/features/collections/index.js', 'utf8'));

function makeRepo(options) {
  options = options || {};
  const calls = [];
  return {
    calls,
    findScopedCollection(scope, name) {
      calls.push({ op: 'findScopedCollection', scope: Object.assign({}, scope), name });
      if (options.findError) return Promise.resolve({ error: options.findError });
      return Promise.resolve({ data: options.existing || null, error: null });
    },
    updateScopedCollectionById(id, row) {
      calls.push({ op: 'updateScopedCollectionById', id, row: Object.assign({}, row) });
      const err = (options.updateErrors || []).shift();
      return Promise.resolve({ error: err || null });
    },
    insertScopedCollection(row) {
      calls.push({ op: 'insertScopedCollection', row: Object.assign({}, row) });
      const err = (options.insertErrors || []).shift();
      return Promise.resolve({ error: err || null });
    },
    deleteStyleAssignment(scope, rowId, collectionName) {
      calls.push({ op: 'deleteStyleAssignment', scope: Object.assign({}, scope), rowId, collectionName });
      return Promise.resolve({ error: options.deleteAssignmentError || null });
    },
    upsertStyleAssignment(row) {
      calls.push({ op: 'upsertStyleAssignment', row: Object.assign({}, row) });
      return Promise.resolve({ error: options.upsertAssignmentError || null });
    },
    deleteOtherStyleAssignments(scope, rowId, collectionName) {
      calls.push({ op: 'deleteOtherStyleAssignments', scope: Object.assign({}, scope), rowId, collectionName });
      return Promise.resolve({ error: options.cleanupAssignmentError || null });
    }
  };
}

function baseContext(repo, overrides) {
  overrides = overrides || {};
  return Object.assign({
    repository: repo,
    isLoggedIn: () => true,
    collectionScopeInfo: group => ({ owner_company: 'Gloria Jeans', owner_group: group || '', owner_type: 'Brand' }),
    collectionMetaByRef: name => ({ name, owner_company: 'Gloria Jeans', owner_group: '', owner_type: 'Brand' }),
    collectionDisplayName: (name, meta) => meta.name || name,
    authUser: { id: 'user-1', email: 'buyer@gloria-jeans.com' },
    isCompanyAdmin: () => false,
    missingColumnError: error => !!(error && error.missingColumn),
    now: () => '2026-08-11T00:00:00.000Z'
  }, overrides);
}

async function rejects(fn, message) {
  let thrown = false;
  try { await fn(); } catch (err) { thrown = true; assert(err.message.includes(message), err.message); }
  assert(thrown, 'expected rejection');
}

(async function run() {
  {
    const repo = makeRepo();
    await CollectionsDomain.persistScopedCollection('Denim', { fsd: '2026-12-23' }, baseContext(repo));
    assert.deepStrictEqual(repo.calls.map(c => c.op), ['findScopedCollection', 'insertScopedCollection']);
    assert.strictEqual(repo.calls[1].row.owner_company, 'Gloria Jeans');
    assert.strictEqual(repo.calls[1].row.owner_group, '');
  }
  {
    const repo = makeRepo();
    await CollectionsDomain.persistScopedCollection('Denim', { owner_group: 'Boys 13+', group: 'Boys 13+' }, baseContext(repo));
    assert.strictEqual(repo.calls[1].row.owner_group, 'Boys 13+');
    assert.strictEqual(repo.calls[1].row.target_group, 'Boys 13+');
  }
  {
    const repo = makeRepo();
    await CollectionsDomain.persistScopedCollection('Supplier Capsule', { owner_company: 'STW', owner_type: 'Supplier' }, baseContext(repo));
    assert.strictEqual(repo.calls[1].row.owner_company, 'STW');
    assert.strictEqual(repo.calls[1].row.owner_type, 'Supplier');
  }
  {
    const repo = makeRepo();
    await CollectionsDomain.persistScopedAssignment({ id: 44 }, 'Denim', 'add', baseContext(repo));
    assert.deepStrictEqual(repo.calls.map(c => c.op), ['upsertStyleAssignment', 'deleteOtherStyleAssignments']);
    assert.strictEqual(repo.calls[0].row.collection_name, 'Denim');
    assert.strictEqual(repo.calls[1].collectionName, 'Denim');
  }
  {
    const repo = makeRepo();
    await CollectionsDomain.persistScopedAssignment({ id: 44 }, 'Denim', 'remove', baseContext(repo));
    assert.deepStrictEqual(repo.calls.map(c => c.op), ['deleteStyleAssignment']);
  }
  {
    const repo = makeRepo();
    await CollectionsDomain.persistScopedAssignment({ id: 44 }, 'Denim', 'add', baseContext(repo, {
      collectionMetaByRef: () => ({ name: 'Denim', owner_company: 'Gloria Jeans', owner_group: 'Girls 13+', owner_type: 'Brand' })
    }));
    assert.strictEqual(repo.calls[0].row.owner_group, 'Girls 13+');
  }
  {
    const repo = makeRepo();
    await CollectionsDomain.persistScopedAssignment({ id: 44 }, 'Denim', 'add', baseContext(repo));
    await CollectionsDomain.persistScopedAssignment({ id: 44 }, 'Denim', 'add', baseContext(repo));
    assert.deepStrictEqual(repo.calls.map(c => c.op), ['upsertStyleAssignment', 'deleteOtherStyleAssignments', 'upsertStyleAssignment', 'deleteOtherStyleAssignments']);
  }
  {
    const repo = makeRepo();
    await CollectionsDomain.persistScopedAssignment({ id: 44 }, 'Denim', 'remove', baseContext(repo, {
      collectionMetaByRef: () => ({ name: 'Denim', owner_company: 'Gloria Jeans', owner_group: 'Boys 13+', owner_type: 'Brand' })
    }));
    assert.strictEqual(repo.calls[0].scope.owner_group, 'Boys 13+');
  }
  {
    const repo = makeRepo();
    await CollectionsDomain.persistScopedAssignment({ id: 44 }, 'Brand Collection', 'add', baseContext(repo));
    assert.strictEqual(repo.calls[0].row.owner_type, 'Brand');
  }
  {
    const repo = makeRepo();
    await CollectionsDomain.persistScopedAssignment({ id: 44 }, 'Supplier Collection', 'add', baseContext(repo, {
      collectionMetaByRef: () => ({ name: 'Supplier Collection', owner_company: 'STW', owner_type: 'Supplier', owner_group: '' })
    }));
    assert.strictEqual(repo.calls[0].row.owner_type, 'Supplier');
    assert.strictEqual(repo.calls[0].row.owner_company, 'STW');
  }
  {
    const repo = makeRepo({ existing: { id: 7, created_by: 'other-user' } });
    await CollectionsDomain.persistScopedCollection('Denim', {}, baseContext(repo, { isCompanyAdmin: () => true }));
    assert.deepStrictEqual(repo.calls.map(c => c.op), ['findScopedCollection', 'updateScopedCollectionById']);
  }
  {
    const repo = makeRepo({ existing: { id: 7, created_by: 'other-user' } });
    await CollectionsDomain.persistScopedCollection('Denim', {}, baseContext(repo, { isCompanyAdmin: () => false }));
    assert.deepStrictEqual(repo.calls.map(c => c.op), ['findScopedCollection']);
  }
  {
    const repo = makeRepo({ existing: { id: 7, created_by: 'other-user' } });
    await CollectionsDomain.persistScopedCollection('Denim', {}, baseContext(repo, { isCompanyAdmin: () => true, authUser: { id: 'admin-view-as', email: 'hello@athletestandards.com' } }));
    assert.strictEqual(repo.calls[1].op, 'updateScopedCollectionById');
  }
  {
    const repo = makeRepo({ existing: { id: 7, created_by: 'user-1' }, updateErrors: [{ missingColumn: true }, null] });
    await CollectionsDomain.persistScopedCollection('Denim', {}, baseContext(repo));
    assert.strictEqual(repo.calls.length, 3);
    assert(!Object.prototype.hasOwnProperty.call(repo.calls[2].row, 'created_by_email'));
  }
  {
    const repo = makeRepo({ insertErrors: [{ missingColumn: true }, null] });
    await CollectionsDomain.persistScopedCollection('Denim', {}, baseContext(repo));
    assert.strictEqual(repo.calls.length, 3);
    assert(!Object.prototype.hasOwnProperty.call(repo.calls[2].row, 'created_by_email'));
  }
  await rejects(async () => {
    const repo = makeRepo({ findError: new Error('select failed') });
    await CollectionsDomain.persistScopedCollection('Denim', {}, baseContext(repo));
  }, 'select failed');
  await rejects(async () => {
    const repo = makeRepo({ existing: { id: 7, created_by: 'user-1' }, updateErrors: [new Error('update failed')] });
    await CollectionsDomain.persistScopedCollection('Denim', {}, baseContext(repo));
  }, 'update failed');
  await rejects(async () => {
    const repo = makeRepo({ upsertAssignmentError: new Error('upsert failed') });
    await CollectionsDomain.persistScopedAssignment({ id: 44 }, 'Denim', 'add', baseContext(repo));
  }, 'upsert failed');
  await rejects(async () => {
    const repo = makeRepo({ deleteAssignmentError: new Error('delete failed') });
    await CollectionsDomain.persistScopedAssignment({ id: 44 }, 'Denim', 'remove', baseContext(repo));
  }, 'delete failed');
  {
    const repo = makeRepo();
    await CollectionsDomain.persistScopedCollection('Denim', {}, baseContext(repo, { isLoggedIn: () => false }));
    await CollectionsDomain.persistScopedAssignment({ id: 44 }, 'Denim', 'add', baseContext(repo, { isLoggedIn: () => false }));
    assert.deepStrictEqual(repo.calls, []);
  }
  {
    const repo = makeRepo();
    await CollectionsDomain.persistScopedCollection('', {}, baseContext(repo));
    await CollectionsDomain.persistScopedAssignment(null, 'Denim', 'add', baseContext(repo));
    assert.deepStrictEqual(repo.calls, []);
  }
  console.log('collections write engine characterization ok 21');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
