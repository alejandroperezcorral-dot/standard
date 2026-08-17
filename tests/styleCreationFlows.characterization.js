const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

[
  'src/features/styles/styleModel.js',
  'src/features/styles/styleCreationModel.js',
  'src/features/styles/styleRepository.js',
  'src/features/styles/styleService.js',
  'src/features/styles/index.js'
].forEach(file => vm.runInThisContext(fs.readFileSync(file, 'utf8')));

const supplierRow = {
  id: 501,
  modelo: 'SUP-501',
  description: 'Supplier created denim jacket',
  supplier: 'STW',
  origin: 'China',
  temporada: 'SS27',
  notes: '[SOURCE:SUPPLIER][SUPPLIER_REF:STW-501][FABRIC_REF:DENIM-998]',
  fob1: 8.5,
  fsd: '2027-01-20',
  units: 2000,
  user_id: 'supplier-user'
};

const supplierStyle = StylesDomain.creation.canonicalFromNegotiationRow(supplierRow, {
  ownerCompanyId: 'supplier-company',
  createdByEmail: 'supplier@stw.com'
});

assert.strictEqual(supplierStyle.style_id, '501', 'Canonical Style identity must preserve the legacy negotiation row id while the bridge exists.');
assert.strictEqual(supplierStyle.created_by_type, 'SUPPLIER', 'Supplier-created styles must be explicit.');
assert.strictEqual(supplierStyle.owner_company_id, 'supplier-company', 'Supplier-created style ownership belongs to the supplier company.');
assert.strictEqual(supplierStyle.master_attributes.supplier_reference, 'STW-501', 'Supplier lifecycle reference must remain independent from future Brand style refs.');
assert.strictEqual(supplierStyle.master_attributes.fabric_reference, 'DENIM-998', 'Fabric reference is part of the canonical style detail.');
assert.strictEqual(
  StylesDomain.creation.myStylesTabForStyle(supplierStyle, 'supplier-company', {}),
  'CREATED',
  'My Styles / Created contains styles created by the current company.'
);
assert.strictEqual(
  StylesDomain.creation.supplierCanPublishToExplore(supplierStyle, { visibility_state: 'PRIVATE' }),
  false,
  'New supplier styles must not enter Explore automatically.'
);
assert.strictEqual(
  StylesDomain.creation.supplierCanPublishToExplore(supplierStyle, { visibility_state: 'PUBLISHED' }),
  true,
  'Supplier styles enter Explore only after explicit publication/share.'
);

const brandRow = {
  id: 777,
  modelo: 'BRAND-777',
  description: 'Brand design brief',
  supplier: '',
  origin: '',
  notes: '[SOURCE:BRAND]',
  user_id: 'brand-user'
};
const brandStyle = StylesDomain.creation.canonicalFromNegotiationRow(brandRow, {
  createdByType: 'BRAND',
  ownerCompanyId: 'brand-company',
  activeCompanyName: 'Gloria Jeans'
});

assert.strictEqual(brandStyle.created_by_type, 'BRAND', 'Brand-created styles must be explicit.');
assert.strictEqual(
  StylesDomain.creation.supplierCanPublishToExplore(brandStyle, { visibility_state: 'PUBLISHED' }),
  false,
  'Brand-created styles do not publish to supplier Explore through the supplier publication rule.'
);

const supplierResponseRow = {
  id: 888,
  modelo: 'SUP-RESPONSE-888',
  description: 'Supplier response to Brand brief',
  supplier: 'STW',
  source: 'SUPPLIER',
  notes: '[SOURCE:SUPPLIER]\n[PARENT_BRAND_STYLE:%7B%22parentRowId%22%3A777%2C%22parentStyleId%22%3A%22brand-style-canonical%22%2C%22parentRef%22%3A%22BRAND-777%22%2C%22brandCompany%22%3A%22Gloria%20Jeans%22%7D]'
};
assert.strictEqual(styleIsSupplierResponse(supplierResponseRow), true, 'Supplier offer styles can be linked to a Brand parent style.');
assert.deepStrictEqual(
  styleParentBrandLink(supplierResponseRow),
  { parentRowId: 777, parentStyleId: 'brand-style-canonical', parentRef: 'BRAND-777', brandCompany: 'Gloria Jeans' },
  'Parent Brand style link should be durable metadata while canonical relation table is pending.'
);
assert.strictEqual(styleIsBrandParent(brandRow), true, 'Brand styles without a parent link are treated as parent models.');
assert.strictEqual(styleBrandResponseLinks(brandRow, [supplierResponseRow]).length, 1, 'One Brand parent model can collect many supplier response styles.');

const brandContext = StylesDomain.creation.createBrandContext({
  brandCompanyId: 'brand-company',
  styleId: supplierStyle.style_id,
  departmentId: 'dept-denim',
  categoryId: 'cat-jackets',
  targetPrice: 7.25,
  costingModelId: 'cost-model-001',
  costingConfigVersionId: 'cfg-v1',
  costingResolvedAt: '2026-08-15T00:00:00Z'
});

assert.deepStrictEqual(
  StylesDomain.creation.validateBrandContext(brandContext),
  { ok: true, missing: [] },
  'Brand context requires Brand-owned taxonomy before costing/RFQ decisions.'
);
assert.strictEqual(
  StylesDomain.creation.brandCanSeeContext('brand-company', brandContext),
  true,
  'The owning Brand can see its own context.'
);
assert.strictEqual(
  StylesDomain.creation.brandCanSeeContext('another-brand', brandContext),
  false,
  'Another Brand must not see private commercial/costing/negotiation context.'
);

const incompleteContext = StylesDomain.creation.createBrandContext({ brandCompanyId: 'brand-company', styleId: supplierStyle.style_id });
assert.deepStrictEqual(
  StylesDomain.creation.validateBrandContext(incompleteContext).missing,
  ['department_id', 'category_id'],
  'Department and category are mandatory Brand-context fields.'
);

const rfq = StylesDomain.creation.createRfq({
  brandCompanyId: 'brand-company',
  styleId: supplierStyle.style_id,
  supplierCompanyIds: ['supplier-a', 'supplier-b']
});
const quoteA = StylesDomain.creation.createQuotation({ rfqId: rfq.rfq_id, styleId: supplierStyle.style_id, supplierCompanyId: 'supplier-a', fob: 7.1 });
const quoteB = StylesDomain.creation.createQuotation({ rfqId: rfq.rfq_id, styleId: supplierStyle.style_id, supplierCompanyId: 'supplier-b', fob: 7.4 });
const response = StylesDomain.creation.createBrandResponse({
  parentBrandRowId: brandRow.id,
  brandCompanyId: 'brand-company',
  supplierCompanyId: 'supplier-company',
  supplierRowId: supplierResponseRow.id,
  responseType: 'EXISTING_STYLE'
});

assert.deepStrictEqual(rfq.supplier_company_ids, ['supplier-a', 'supplier-b'], 'One Brand style can request quotations from many suppliers.');
assert.strictEqual(quoteA.style_id, quoteB.style_id, 'Multiple quotations must reference the same canonical Style ID.');
assert.strictEqual(
  StylesDomain.creation.confirmedOutcomeClosesCanonicalStyle(),
  false,
  'A Brand confirmation must not globally close a Supplier style for other Brands.'
);
assert.deepStrictEqual(
  StylesDomain.creation.validateBrandResponse(response),
  { ok: true, missing: [] },
  'Supplier responses should validate against Brand parent, Brand company, Supplier company and Supplier style.'
);

const indexSource = fs.readFileSync('index.html', 'utf8');
assert(indexSource.includes("if(rowStatus(r)==='CLOSED')return false;"), 'Suppliers must not see closed Brand parent models in Explore.');

console.log('style creation flows characterization ok');
