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
  const state = { styles: [], linkedRows: [] };
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

  console.log('style creation runtime bridge characterization ok');
})();
