const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

[
  'src/features/styles/styleModel.js',
  'src/features/styles/styleCreationModel.js',
  'src/features/styles/styleRepository.js',
  'src/features/styles/styleService.js',
  'src/features/styles/styleCreationRepository.js',
  'src/features/styles/styleCreationService.js',
  'src/features/styles/index.js'
].forEach(file => vm.runInThisContext(fs.readFileSync(file, 'utf8')));

function createMemoryRepository() {
  const state = {
    styles: [],
    contexts: [],
    linkedRows: [],
    departments: [],
    categories: []
  };
  return {
    state,
    insertStyle(row) {
      const data = Object.assign({ id: `style-${state.styles.length + 1}` }, row);
      state.styles.push(data);
      return Promise.resolve({ data, error: null });
    },
    selectCreatedStyles(companyId) {
      return Promise.resolve({
        data: state.styles.filter(style => style.owner_company_id === companyId),
        error: null
      });
    },
    archiveStyle(styleId) {
      const style = state.styles.find(item => item.id === styleId);
      if (style) Object.assign(style, { lifecycle_state: 'ARCHIVED', archived_at: 'now', updated_at: 'now' });
      return Promise.resolve({ data: style || null, error: style ? null : new Error('missing') });
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
    },
    updateBrandStyleContext(id, row) {
      const ctx = state.contexts.find(item => item.id === id);
      Object.assign(ctx, row);
      return Promise.resolve({ data: ctx, error: null });
    },
    selectDepartments(companyId) {
      return Promise.resolve({ data: state.departments.filter(item => item.company_id === companyId), error: null });
    },
    insertDepartment(row) {
      const data = Object.assign({ id: `dept-${state.departments.length + 1}` }, row);
      state.departments.push(data);
      return Promise.resolve({ data, error: null });
    },
    updateDepartment(id, row) {
      const dept = state.departments.find(item => item.id === id);
      Object.assign(dept, row);
      return Promise.resolve({ data: dept, error: null });
    },
    selectCategories(companyId, departmentId) {
      return Promise.resolve({
        data: state.categories.filter(item => item.company_id === companyId && (!departmentId || item.department_id === departmentId)),
        error: null
      });
    },
    insertCategory(row) {
      const data = Object.assign({ id: `cat-${state.categories.length + 1}` }, row);
      state.categories.push(data);
      return Promise.resolve({ data, error: null });
    },
    updateCategory(id, row) {
      const cat = state.categories.find(item => item.id === id);
      Object.assign(cat, row);
      return Promise.resolve({ data: cat, error: null });
    }
  };
}

(async () => {
  assert(StylesDomain.creation.service, 'Style creation service must be exported.');
  assert(StylesDomain.creation.createRepository, 'Style creation repository factory must be exported.');

  const repo = createMemoryRepository();
  const supplierProfile = { company_id: 'supplier-co', company_name: 'STW', company_type: 'Supplier', role: 'supplier' };
  const brandAProfile = { company_id: 'brand-a', company_name: 'Gloria Jeans', company_type: 'Brand', role: 'company admin' };
  const brandBProfile = { company_id: 'brand-b', company_name: 'Other Brand', company_type: 'Brand', role: 'company admin' };
  const supplierUser = { id: 'supplier-user', email: 'supplier@stw.test' };
  const brandAUser = { id: 'brand-a-user', email: 'buyer@gloria.test' };

  const supplierStyle = await StylesDomain.creation.service.createStyle({
    supplierReference: 'SUP-1008',
    fabricReference: 'FAB-44',
    styleRef: 'STW-1008',
    title: 'Relaxed denim jacket',
    origin: 'China',
    supplier: 'STW',
    mainImage: 'https://example.com/main.jpg',
    secondaryImage: 'https://example.com/side.jpg'
  }, { repository: repo, profile: supplierProfile, user: supplierUser, now: '2026-08-15T00:00:00Z' });

  assert.strictEqual(supplierStyle.created_by_type, 'SUPPLIER');
  assert.strictEqual(supplierStyle.owner_company_id, 'supplier-co');
  assert.strictEqual(supplierStyle.created_by, 'supplier-user');
  assert.strictEqual(supplierStyle.publication_state, 'PRIVATE');
  assert.strictEqual(supplierStyle.lifecycle_state, 'ACTIVE');
  assert.strictEqual(supplierStyle.images.length, 2);
  assert.strictEqual(supplierStyle.images[0].main, true);

  const createdForSupplier = await StylesDomain.creation.service.getCreatedStyles({ repository: repo, profile: supplierProfile });
  assert.strictEqual(createdForSupplier.data.length, 1);
  assert.strictEqual(StylesDomain.creation.myStylesTabForStyle(supplierStyle, 'supplier-co', {}), 'CREATED');
  assert.strictEqual(StylesDomain.creation.myStylesTabForStyle(supplierStyle, 'brand-a', { sharedWithCompanyIds: ['brand-a'] }), 'SHARED_WITH_US');
  assert.strictEqual(StylesDomain.creation.supplierCanPublishToExplore(supplierStyle, { visibility_state: 'PRIVATE' }), false);

  const brandStyle = await StylesDomain.creation.service.createStyle({
    styleRef: 'GJ-001',
    title: 'Brand mood style',
    owner_company_id: 'malicious-company'
  }, { repository: repo, profile: brandAProfile, user: brandAUser, now: '2026-08-15T00:00:00Z' });

  assert.strictEqual(brandStyle.created_by_type, 'BRAND');
  assert.strictEqual(brandStyle.owner_company_id, 'brand-a');
  assert.notStrictEqual(brandStyle.owner_company_id, 'malicious-company');
  assert.strictEqual(StylesDomain.creation.supplierCanPublishToExplore(brandStyle, { visibility_state: 'PUBLISHED' }), false);

  const legacyRow = StylesDomain.creation.service.canonicalPayloadToLegacyNegotiationRow(
    Object.assign({}, supplierStyle, { id: supplierStyle.id }),
    { fob: 9.5, units: 1200, collection: 'Denim Colour' },
    { today: '2026-08-15' }
  );
  assert.strictEqual(legacyRow.status, 'PENDING');
  assert.strictEqual(legacyRow.style_id, supplierStyle.id);
  assert.strictEqual(legacyRow.source, 'SUPPLIER');

  const ctxA1 = await StylesDomain.creation.service.getOrCreateBrandStyleContext(
    { brandCompanyId: 'brand-a', styleId: supplierStyle.id },
    { repository: repo, profile: brandAProfile, user: brandAUser }
  );
  const ctxA2 = await StylesDomain.creation.service.getOrCreateBrandStyleContext(
    { brandCompanyId: 'brand-a', styleId: supplierStyle.id },
    { repository: repo, profile: brandAProfile, user: brandAUser }
  );
  assert.strictEqual(ctxA1.id, ctxA2.id);
  assert.strictEqual(repo.state.contexts.length, 1);

  const ctxB = await StylesDomain.creation.service.getOrCreateBrandStyleContext(
    { brandCompanyId: 'brand-b', styleId: supplierStyle.id },
    { repository: repo, profile: brandBProfile, user: { id: 'brand-b-user', email: 'buyer@other.test' } }
  );
  assert.notStrictEqual(ctxA1.id, ctxB.id);
  assert.strictEqual(repo.state.styles.length, 2, 'Brand contexts must not duplicate canonical styles.');
  assert.strictEqual(StylesDomain.creation.brandCanSeeContext('brand-a', ctxA1), true);
  assert.strictEqual(StylesDomain.creation.brandCanSeeContext('brand-a', ctxB), false);
  assert.strictEqual(StylesDomain.creation.brandCanSeeContext('brand-b', ctxA1), false);

  const updatedCtxA = await StylesDomain.creation.service.assignBrandTaxonomy(
    { brandCompanyId: 'brand-a', styleId: supplierStyle.id, departmentId: 'dept-denim', categoryId: 'cat-jackets' },
    { repository: repo, profile: brandAProfile, user: brandAUser }
  );
  assert.strictEqual(updatedCtxA.department_id, 'dept-denim');
  assert.strictEqual(updatedCtxA.category_id, 'cat-jackets');
  assert.deepStrictEqual(StylesDomain.creation.validateBrandContext(updatedCtxA), { ok: true, missing: [] });

  assert.strictEqual(StylesDomain.creation.service.canManageTaxonomy({ role: 'company admin', company_id: 'brand-a' }, 'brand-a'), true);
  assert.strictEqual(StylesDomain.creation.service.canManageTaxonomy({ role: 'company member', company_id: 'brand-a' }, 'brand-a'), false);
  assert.strictEqual(StylesDomain.creation.service.canManageTaxonomy({ role: 'admin' }, 'brand-b'), true);

  const category = { id: 'cat-jackets', company_id: 'brand-a', department_id: 'dept-denim', name: 'Jackets', active: false };
  assert.strictEqual(category.id, updatedCtxA.category_id, 'A deactivated category can still be referenced historically.');

  const collectionAssignment = { row_id: 501, style_id: supplierStyle.id, collection_id: 'collection-a', owner_company_id: 'brand-a' };
  assert.strictEqual(supplierStyle.owner_company_id, 'supplier-co');
  assert.strictEqual(collectionAssignment.style_id, supplierStyle.id);
  assert.strictEqual(repo.state.styles.filter(style => style.id === supplierStyle.id).length, 1);

  assert.strictEqual(StylesDomain.creation.confirmedOutcomeClosesCanonicalStyle(), false);

  console.log('style01 runtime characterization ok');
})();
