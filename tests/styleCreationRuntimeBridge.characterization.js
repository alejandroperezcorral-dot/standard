const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

global.window = global;
global.ROWS = [];
global.AUTH_USER = { id: 'supplier-user', email: 'supplier@stw.test' };
global.AUTH_PROFILE = {
  company_id: 'supplier-co',
  company_name: 'STW',
  company_type: 'Supplier',
  role: 'supplier'
};
global.sb = {};
global.activeCompanyName = () => 'STW';
global.activeCompanyType = () => 'Supplier';
global.styleSource = row => row && row.source || 'SUPPLIER';
global.canonicalStyleArchived = style => style && style.lifecycle_state === 'ARCHIVED';
global.escHtml = value => String(value || '');

[
  'src/features/styles/styleModel.js',
  'src/features/styles/styleCreationModel.js',
  'src/features/styles/styleRepository.js',
  'src/features/styles/styleService.js',
  'src/features/styles/styleCreationRepository.js',
  'src/features/styles/styleCreationService.js',
  'src/features/styles/index.js',
  'src/features/styles/styleCreationRuntime.js'
].forEach(file => vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file }));

function createMemoryRepository() {
  const state = { styles: [], contexts: [], linkedRows: [] };
  return {
    state,
    insertStyle(row) {
      const data = Object.assign({ id: `style-${state.styles.length + 1}` }, row);
      state.styles.push(data);
      return Promise.resolve({ data, error: null });
    },
    linkNegotiationRow(rowId, styleId) {
      state.linkedRows.push({ rowId, styleId });
      return Promise.resolve({ data: null, error: null });
    },
    selectBrandStyleContext(brandCompanyId, styleId) {
      return Promise.resolve({
        data: state.contexts.find(ctx => ctx.brand_company_id === brandCompanyId && ctx.style_id === styleId) || null,
        error: null
      });
    },
    insertBrandStyleContext(row) {
      const data = Object.assign({ id: `ctx-${state.contexts.length + 1}` }, row);
      state.contexts.push(data);
      return Promise.resolve({ data, error: null });
    }
  };
}

(async () => {
  const repo = createMemoryRepository();
  StylesDomain.creation.createRepository = () => repo;

  const legacyRow = {
    id: 9001,
    source: 'SUPPLIER',
    modelo: 'STW-9001',
    desc: 'Canonical bridge jacket',
    supplier: 'STW',
    origin: 'China'
  };

  const style = await StyleCreationRuntime.persistCanonicalForLegacyRow(legacyRow, {
    id: legacyRow.id,
    styleRef: legacyRow.modelo,
    title: legacyRow.desc,
    supplier: legacyRow.supplier,
    origin: legacyRow.origin
  });

  assert(style, 'A canonical style should be created for the legacy row.');
  assert.strictEqual(repo.state.styles.length, 1);
  assert.strictEqual(repo.state.styles[0].legacy_negotiation_row_id, 9001);
  assert.strictEqual(repo.state.styles[0].owner_company_id, 'supplier-co');
  assert.strictEqual(repo.state.styles[0].created_by_type, 'SUPPLIER');
  assert.strictEqual(legacyRow.style_id, style.id);
  assert.strictEqual(legacyRow.canonical_style_id, style.id);
  assert.deepStrictEqual(repo.state.linkedRows, [{ rowId: 9001, styleId: style.id }]);

  global.AUTH_USER = { id: 'brand-user', email: 'buyer@gloria.test' };
  global.AUTH_PROFILE = {
    company_id: 'brand-co',
    company_name: 'Gloria Jeans',
    company_type: 'Brand',
    role: 'company admin'
  };
  global.activeCompanyName = () => 'Gloria Jeans';
  global.activeCompanyType = () => 'Brand';

  const brandRow = {
    id: 9002,
    source: 'BUYER',
    modelo: 'GJ-9002',
    desc: 'Brand created overshirt',
    supplier: 'Gloria Jeans',
    origin: 'Bangladesh'
  };

  const brandStyle = await StyleCreationRuntime.persistCanonicalForLegacyRow(brandRow, {
    id: brandRow.id,
    styleRef: brandRow.modelo,
    title: brandRow.desc,
    supplier: brandRow.supplier,
    origin: brandRow.origin,
    departmentId: 'dept-brand-denim',
    categoryId: 'cat-brand-overshirts',
    fob: 8.75
  });

  assert(brandStyle, 'A canonical style should be created for the brand row.');
  assert.strictEqual(brandStyle.created_by_type, 'BRAND');
  assert.strictEqual(brandStyle.owner_company_id, 'brand-co');
  assert.strictEqual(brandRow.style_id, brandStyle.id);
  assert.strictEqual(brandRow.canonical_style_id, brandStyle.id);
  assert.strictEqual(repo.state.contexts.length, 1);
  assert.strictEqual(repo.state.contexts[0].brand_company_id, 'brand-co');
  assert.strictEqual(repo.state.contexts[0].style_id, brandStyle.id);
  assert.strictEqual(repo.state.contexts[0].department_id, 'dept-brand-denim');
  assert.strictEqual(repo.state.contexts[0].category_id, 'cat-brand-overshirts');
  assert.strictEqual(brandRow.brand_style_context_id, repo.state.contexts[0].id);
  assert.strictEqual(brandRow.brand_style_context_missing_taxonomy, false);

  console.log('style creation runtime bridge characterization ok');
})();
