const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

vm.runInThisContext(fs.readFileSync('src/features/styles/productDetailIdentity.js', 'utf8'));

const STYLE_ID = '9c11fd42-0d53-4ed6-82f1-c1d4bc7b88a9';
const OTHER_STYLE_ID = '12c7e610-3da1-4855-b126-8391b3728c84';
const rowA = { id: 101, modelo: 'A', style_id: STYLE_ID, brand_style_context_id: 'ctx-a' };
const rowB = { id: 102, modelo: 'B', style_id: OTHER_STYLE_ID };

let resolved = ProductDetailIdentity.resolve(101, { rows: [rowA, rowB] });
assert.strictEqual(resolved.ok, true, 'legacy numeric call should resolve');
assert.strictEqual(resolved.reason, 'ROW');
assert.strictEqual(resolved.rowId, 101);
assert.strictEqual(resolved.styleId, STYLE_ID);
assert.strictEqual(resolved.brandStyleContextId, 'ctx-a');
assert.strictEqual(resolved.legacyRow, rowA);

resolved = ProductDetailIdentity.resolve({ rowId: '102' }, { rows: [rowA, rowB] });
assert.strictEqual(resolved.ok, true, 'legacy row lookup should normalize numeric row id');
assert.strictEqual(resolved.rowId, 102);
assert.strictEqual(resolved.legacyRow, rowB);

resolved = ProductDetailIdentity.resolve({ styleId: STYLE_ID }, { rows: [rowA, rowB] });
assert.strictEqual(resolved.ok, true, 'canonical style with one linked row should resolve');
assert.strictEqual(resolved.reason, 'STYLE_WITH_ROW');
assert.strictEqual(resolved.styleId, STYLE_ID);
assert.strictEqual(resolved.rowId, 101);
assert.strictEqual(resolved.legacyRow, rowA);

const canonicalOnly = { id: '73fc5758-b5f7-4ee2-a39c-cbb0aa2f014c', style_ref: 'CAN-001' };
resolved = ProductDetailIdentity.resolve({ styleId: canonicalOnly.id, canonicalStyle: canonicalOnly }, { rows: [rowA, rowB] });
assert.strictEqual(resolved.ok, true, 'canonical-only style should resolve without a row');
assert.strictEqual(resolved.reason, 'STYLE_ONLY');
assert.strictEqual(resolved.rowId, null);
assert.strictEqual(resolved.styleId, canonicalOnly.id);
assert.strictEqual(resolved.canonicalStyle, canonicalOnly);

resolved = ProductDetailIdentity.resolve(STYLE_ID, { rows: [rowA] });
assert.strictEqual(resolved.ok, false, 'bare UUID must not be treated as legacy row id');
assert.strictEqual(resolved.reason, 'STYLE_NOT_EXPLICIT');
assert.strictEqual(resolved.rowId, null);
assert.strictEqual(resolved.styleId, STYLE_ID);

resolved = ProductDetailIdentity.resolve({ styleId: STYLE_ID }, { rows: [rowA, { id: 201, style_id: STYLE_ID }] });
assert.strictEqual(resolved.ok, false, 'multiple rows for the same style must fail closed');
assert.strictEqual(resolved.reason, 'AMBIGUOUS_STYLE_ROWS');
assert.strictEqual(resolved.rowId, null);
assert.strictEqual(resolved.styleId, STYLE_ID);

resolved = ProductDetailIdentity.resolve({ styleId: 'missing-style' }, { rows: [rowA, rowB] });
assert.strictEqual(resolved.ok, true, 'unknown explicit style id is still a safe canonical-only identity');
assert.strictEqual(resolved.reason, 'STYLE_ONLY');
assert.strictEqual(resolved.legacyRow, null);

resolved = ProductDetailIdentity.resolve({ rowId: 101, styleId: STYLE_ID, brandStyleContextId: 'ctx-explicit' }, { rows: [rowA] });
assert.strictEqual(resolved.rowId, 101, 'rowId stays separate');
assert.strictEqual(resolved.styleId, STYLE_ID, 'styleId stays separate');
assert.strictEqual(resolved.brandStyleContextId, 'ctx-explicit', 'explicit brand context is preserved');

console.log('product detail identity characterization ok');
