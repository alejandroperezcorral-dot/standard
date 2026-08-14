const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

global.window = global;
global.document = {
  getElementById() { return null; },
  querySelectorAll() { return []; }
};
global.confirm = () => true;

vm.runInThisContext(fs.readFileSync('src/features/costing/costResultModel.js', 'utf8'));
vm.runInThisContext(fs.readFileSync('src/features/costing/costConnector.js', 'utf8'));
vm.runInThisContext(fs.readFileSync('src/features/costing/core/costModel001WorkbookDefaults.js', 'utf8'));
vm.runInThisContext(fs.readFileSync('src/features/costing/core/costModel001.js', 'utf8'));
vm.runInThisContext(fs.readFileSync('src/features/costing/costModel.js', 'utf8'));
vm.runInThisContext(fs.readFileSync('src/features/costing/costService.js', 'utf8'));
vm.runInThisContext(fs.readFileSync('src/features/costing/index.js', 'utf8'));
vm.runInThisContext(fs.readFileSync('src/features/costing/settings/costingSettingsRepository.js', 'utf8'));
vm.runInThisContext(fs.readFileSync('src/features/costing/settings/costingSettingsState.js', 'utf8'));
vm.runInThisContext(fs.readFileSync('src/features/costing/settings/costingSettingsService.js', 'utf8'));
vm.runInThisContext(fs.readFileSync('src/features/costing/settings/costingSettingsRenderer.js', 'utf8'));
vm.runInThisContext(fs.readFileSync('src/features/costing/settings/index.js', 'utf8'));

const draft = {
  id: 'draft-1',
  config_code: 'draft-1',
  config_label: 'Draft v1',
  lifecycle_status: 'DRAFT',
  semantic_validation_status: 'NOT_VALIDATED',
  formula_version: 1,
  base_config: CostingSettingsService.defaultConfig()
};
const active = {
  id: 'active-1',
  config_code: 'active-1',
  config_label: 'Current Active',
  lifecycle_status: 'ACTIVE',
  semantic_validation_status: 'VALID',
  formula_version: 1,
  base_config: CostingSettingsService.defaultConfig()
};
const archived = {
  id: 'archived-1',
  config_code: 'fw26',
  config_label: 'FW26',
  lifecycle_status: 'ARCHIVED',
  semantic_validation_status: 'VALID',
  formula_version: 1,
  base_config: CostingSettingsService.defaultConfig()
};

CostingSettingsState.set({
  company: { id: 'company-1', name: 'Gloria Jeans' },
  settings: { cost_source_type: 'FOB_ONLY' },
  versions: [],
  selectedVersionId: null,
  overrides: [],
  components: [],
  loading: false,
  error: null
});
assert.ok(CostingSettingsRenderer.render(CostingSettingsState.get()).includes('FOB only'), 'FOB_ONLY state renders without requiring a model config');

CostingSettingsState.set({
  settings: { cost_source_type: 'STDTEX_MODEL', active_config_version_id: 'active-1' },
  versions: [draft, active, archived],
  selectedVersionId: draft.id,
  overrides: [{ id: 'ov-1', season_key: 'FW26', origin_key: 'VIETNAM', category_key: 'Pants Commercial', values: { fixedDuty: 2.2, dutyPercent: 0 } }],
  components: [{ id: 'cmp-1', name: 'Inspection', calculation_type: 'FIXED_PER_UNIT', value: 0.1, currency: 'USD', enabled: true }]
});
let html = CostingSettingsRenderer.render(CostingSettingsState.get());
assert.ok(html.includes('Save Draft'), 'Draft version exposes draft save action');
assert.ok(html.includes('Logistics & Transport'), 'Draft version exposes logistics table section');
assert.ok(html.includes('Duties & Tariffs'), 'Draft version exposes duties table section');
assert.ok(html.includes('Add Override'), 'Draft version exposes override editor');
assert.ok(html.includes('Add Cost'), 'Draft version exposes additional cost editor');
assert.ok(html.includes('Requires trusted backend semantic validation'), 'Invalid draft clearly shows backend validation gate');

CostingSettingsState.set({ selectedVersionId: active.id });
html = CostingSettingsRenderer.render(CostingSettingsState.get());
assert.ok(html.includes('Read only'), 'Active version renders read-only');
assert.ok(html.includes('Create new Draft'), 'Active version points users to draft workflow');
assert.ok(!html.includes('Save Draft'), 'Active version cannot be edited directly');

CostingSettingsState.set({ selectedVersionId: archived.id });
html = CostingSettingsRenderer.render(CostingSettingsState.get());
assert.ok(html.includes('Duplicate as Draft'), 'Archived version can be duplicated as draft');
assert.ok(!html.includes('Save Draft'), 'Archived version cannot be edited directly');

const preview = CostingSettingsService.testConfiguration(draft, [], {
  fob: 8,
  pvp_rub: 1999,
  origin: 'VIETNAM',
  transport: 'SEA-TRUCK',
  category: 'Pants Commercial',
  units: 1200,
  weight: 0.23
});
assert.strictEqual(typeof preview.landedCost, 'number', 'Test flow uses Cost Model 001 evaluator');
assert.strictEqual(CostingSettingsService.MODEL_001_CODE, 'cost-model-001', 'Model selector is limited to the persisted Model 001 code');
assert.strictEqual(Object.keys(draft.base_config.freightRoutes).length, 21, 'Model 001 defaults include workbook logistics rows');
assert.strictEqual(draft.base_config.dutyRows.length, 337, 'Model 001 defaults include workbook duty rows');
assert.ok(draft.base_config.dutyRows[0].dept, 'Duty rows preserve department separately from category');

const draftPatch = CostingSettingsService._versionPatchFromBaseConfig(Object.assign({}, draft.base_config, {
  id: 'internal-id',
  company_id: 'internal-company',
  cost_model_id: 'internal-model',
  formula_version: 1,
  lifecycle_status: 'DRAFT'
}));
assert.ok(draftPatch.assumptions, 'Draft base config patch keeps editable assumptions');
assert.ok(draftPatch.freightRoutes, 'Draft base config patch keeps editable logistics rows');
assert.ok(draftPatch.dutyRows, 'Draft base config patch keeps editable duty rows');
assert.ok(!Object.prototype.hasOwnProperty.call(draftPatch, 'id'), 'Draft base config patch never sends internal id');
assert.ok(!Object.prototype.hasOwnProperty.call(draftPatch, 'company_id'), 'Draft base config patch never sends internal company id');
assert.ok(!Object.prototype.hasOwnProperty.call(draftPatch, 'cost_model_id'), 'Draft base config patch never sends internal model id');
assert.ok(!Object.prototype.hasOwnProperty.call(draftPatch, 'formula_version'), 'Draft base config patch never sends database formula version');
assert.ok(!Object.prototype.hasOwnProperty.call(draftPatch, 'lifecycle_status'), 'Draft base config patch never sends lifecycle status');

console.log('costing settings characterization ok 22');
