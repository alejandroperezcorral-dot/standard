const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

global.window = global;
global.ROWS = [];
global.AUTH_USER = { id: 'brand-user', email: 'buyer@gloria.test' };
global.AUTH_PROFILE = { company_id: 'brand-co', company_name: 'Gloria Jeans', company_type: 'Brand' };
global.activeCompanyName = () => 'Gloria Jeans';
global.activeCompanyType = () => 'Brand';
global.styleSource = row => row && row.source || 'BRAND';
global.canonicalStyleArchived = style => style && style.lifecycle_state === 'ARCHIVED';
global.escHtml = value => String(value || '');
global.statusDot = status => '<i>' + status + '</i>';

[
  'src/features/styles/styleModel.js',
  'src/features/styles/styleCreationModel.js',
  'src/features/styles/styleCreationRuntime.js'
].forEach(file => vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file }));

const canonicalStyle = {
  id: '6454a4a4-aa4e-4800-9138-3f1d86887f2d',
  style_ref: 'GJ-CAN-001',
  title: 'Canonical-only overshirt',
  owner_company_name: 'Gloria Jeans',
  created_by_type: 'BRAND',
  master_attributes: { origin: 'Bangladesh' }
};

let productDetailInput = null;
let chatOpened = false;
global.openStyleDetail = input => { productDetailInput = input; };
global.openStyleChat = () => { chatOpened = true; };

StyleCreationRuntime._state.created = [canonicalStyle];
StyleCreationRuntime.openStyle(canonicalStyle.id, '');

assert(productDetailInput, 'My Styles should call Product Detail for canonical-only style');
assert.strictEqual(productDetailInput.styleId, canonicalStyle.id);
assert.strictEqual(productDetailInput.canonicalStyle, canonicalStyle);
assert.strictEqual(productDetailInput.workspace, 'my-styles');
assert.strictEqual(productDetailInput.rowId, undefined, 'canonical-only My Styles open should not require a row id');
assert.strictEqual(chatOpened, false, 'My Styles product open must not open chat');

const linkedStyle = {
  id: 'ad38252e-6506-486e-a53b-6d26d49f8d91',
  legacy_negotiation_row_id: 55,
  style_ref: 'GJ-LINKED-001'
};
global.ROWS = [{ id: 55, style_id: linkedStyle.id, modelo: 'GJ-LINKED-001' }];
StyleCreationRuntime._state.created = [linkedStyle];
productDetailInput = null;
StyleCreationRuntime.openStyle(linkedStyle.id, '55');

assert(productDetailInput, 'My Styles should call Product Detail for linked canonical style');
assert.strictEqual(productDetailInput.styleId, linkedStyle.id);
assert.strictEqual(productDetailInput.canonicalStyle, linkedStyle);
assert.strictEqual(productDetailInput.rowId, undefined, 'linked canonical style should still enter through canonical identity');

console.log('my styles product detail identity characterization ok');
