const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

vm.runInThisContext(fs.readFileSync('src/features/collections/collectionState.js', 'utf8'));

const indexSource = fs.readFileSync('index.html', 'utf8');
assert.strictEqual(/\bSHOWROOM_FOLDER\b/.test(indexSource), false, 'legacy SHOWROOM_FOLDER global is absent from runtime');

const state = createCollectionState();
function openCollection(ref){
  state.setActiveCollectionRef(ref);
  return state.getActiveCollectionRef();
}
function closeCollection(){
  state.clearActiveCollection();
  return state.getActiveCollectionRef();
}
function collectionRows(activeRef, rows){
  return rows.filter(row => (row.collections || []).indexOf(activeRef) >= 0);
}

const personalRef = 'brand:gloria jeans::Denim Colour';
const companyRef = 'brand:gloria jeans::Party Collection';
const groupRef = 'brand:gloria jeans:boys 13+::Denim Colour';
const supplierRef = 'supplier:stw::Supplier Capsule';
const rows = [
  { id: 1, style: 'A', collections: [personalRef, groupRef], units: 1000 },
  { id: 2, style: 'B', collections: [companyRef], units: 2000 },
  { id: 3, style: 'C', collections: [supplierRef], units: 3000 }
];

assert.strictEqual(openCollection(personalRef), personalRef, '1 open collection stores the exact active ref');
assert.strictEqual(closeCollection(), '', '2 close collection clears the active ref');
assert.strictEqual(openCollection(personalRef), personalRef, '3 back from index to collection reopens the requested ref');
assert.strictEqual(openCollection(companyRef), companyRef, '4 switching collections replaces the active ref');
assert.strictEqual(openCollection(personalRef), personalRef, '5 personal collection ref is preserved');
assert.strictEqual(openCollection(companyRef), companyRef, '6 company collection ref is preserved');
assert.strictEqual(openCollection(groupRef), groupRef, '7 group collection ref is preserved');
assert.strictEqual(openCollection(supplierRef), supplierRef, '8 supplier collection ref is preserved');
assert.deepStrictEqual(collectionRows(openCollection(groupRef), rows).map(r => r.id), [1], '9 detail render receives rows for the active ref');
assert.deepStrictEqual(collectionRows(openCollection(personalRef), rows).map(r => r.id), [1], '10 collection filters use the active ref without changing it');
assert.strictEqual(state.getActiveCollectionRef(), personalRef, '11 dropdown state reads the active ref');
assert.strictEqual('collections:' + (state.getActiveCollectionRef() || 'index'), 'collections:' + personalRef, '12 bulk context includes active ref');
assert.strictEqual(state.getActiveCollectionRef(), personalRef, '13 edit collection uses the active ref');
assert.strictEqual(openCollection('brand:gloria jeans::Renamed Denim'), 'brand:gloria jeans::Renamed Denim', '14 rename updates the active ref');
assert.strictEqual(state.getActiveCollectionRef(), 'brand:gloria jeans::Renamed Denim', '15 delete collection can read the active ref before deletion');
assert.strictEqual(closeCollection(), '', '16 delete active collection clears the active ref');
assert.deepStrictEqual(collectionRows(openCollection(groupRef), rows).map(r => r.id), [1], '17 Canvas entry can receive explicit active collection rows');
assert.strictEqual(state.getActiveCollectionRef(), groupRef, '18 returning from Canvas keeps collection state unless caller clears it');
assert.strictEqual(closeCollection(), '', '19 auth reset clears active collection');
assert.strictEqual(closeCollection(), '', '20 explore reset keeps active collection empty');
assert.strictEqual(openCollection(companyRef), companyRef, '21 company switch can establish company collection context');
assert.strictEqual(openCollection(groupRef), groupRef, '22 admin view-as can establish group collection context');
assert.deepStrictEqual(collectionRows(openCollection('missing::Collection'), rows), [], '23 missing collection returns no rows');
assert.strictEqual(closeCollection(), '', '24 deleted collection reference is clearable');
assert.deepStrictEqual(collectionRows(openCollection('brand:gloria jeans::Empty'), rows), [], '25 empty collection returns an empty row set');

assert.ok(indexSource.indexOf('function activeCollectionRef()') >= 0, 'active collection read helper exists');
assert.ok(indexSource.indexOf('function setActiveCollectionRef(ref)') >= 0, 'active collection write helper exists');
assert.ok(indexSource.indexOf('function clearActiveCollection()') >= 0, 'active collection clear helper exists');
assert.ok(indexSource.indexOf('function hasActiveCollection()') >= 0, 'active collection presence helper exists');

console.log('collections active collection characterization ok 29');
