const HistoricalSourceClassification = Object.freeze({
  INDEPENDENT_REFERENCE: 'INDEPENDENT_REFERENCE',
  DERIVED_FROM_CURRENT_CM: 'DERIVED_FROM_CURRENT_CM',
  UNKNOWN_PROVENANCE: 'UNKNOWN_PROVENANCE',
  SYNTHETIC: 'SYNTHETIC',
  UNUSABLE: 'UNUSABLE'
});

const HistoricalValidationResult = Object.freeze({
  MATCH: 'MATCH',
  ROUNDING_ONLY: 'ROUNDING_ONLY',
  MISMATCH: 'MISMATCH',
  REFERENCE_MISSING: 'REFERENCE_MISSING',
  INPUT_MISSING: 'INPUT_MISSING'
});

const HistoricalMismatchCause = Object.freeze({
  INPUT_MAPPING_ERROR: 'INPUT_MAPPING_ERROR',
  REFERENCE_ROUNDING: 'REFERENCE_ROUNDING',
  MODEL_001_FORMULA_DIFFERENCE: 'MODEL_001_FORMULA_DIFFERENCE',
  MISSING_HISTORICAL_ASSUMPTION: 'MISSING_HISTORICAL_ASSUMPTION',
  HISTORICAL_OVERRIDE: 'HISTORICAL_OVERRIDE',
  CATEGORY_SPECIFIC_RULE: 'CATEGORY_SPECIFIC_RULE',
  DEPARTMENT_SPECIFIC_RULE: 'DEPARTMENT_SPECIFIC_RULE',
  FX_DATE_DIFFERENCE: 'FX_DATE_DIFFERENCE',
  FREIGHT_RATE_DIFFERENCE: 'FREIGHT_RATE_DIFFERENCE',
  DUTY_RULE_DIFFERENCE: 'DUTY_RULE_DIFFERENCE',
  DATA_QUALITY: 'DATA_QUALITY',
  UNKNOWN: 'UNKNOWN'
});

const DEFAULT_COST_MODEL_001_TOLERANCES = Object.freeze({
  money: 0.01,
  percentageRatio: 0.0005,
  ratio: 0.0005,
  days: 0,
  exact: 0
});

const DEFAULT_FIELD_MAP = Object.freeze({
  landedCost: { outputKey: 'landedCost', tolerance: 'money' },
  ldp: { outputKey: 'landedCost', tolerance: 'money' },
  imu: { outputKey: 'imu', tolerance: 'percentageRatio' },
  markup: { outputKey: 'markup', tolerance: 'ratio' },
  targetFob: { outputKey: 'targetFob', tolerance: 'money' },
  freightPerUnit: { outputKey: 'freightPerUnit', tolerance: 'money' },
  duty: { outputKey: 'duty', tolerance: 'money' },
  transitDays: { outputKey: 'transitDays', tolerance: 'days' }
});

function toValidationNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const cleaned = String(value).replace(/[%,$€₽\s]/g, '').replace(',', '.');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeReferenceValue(key, value) {
  const numeric = toValidationNumber(value);
  if (numeric === null) return null;
  if (key === 'imu' || key === 'markup') {
    return Math.abs(numeric) > 1 ? numeric / 100 : numeric;
  }
  return numeric;
}

function compactObject(value) {
  const result = {};
  Object.keys(value || {}).forEach((key) => {
    const entry = value[key];
    if (entry !== null && entry !== undefined && entry !== '') result[key] = entry;
  });
  return result;
}

function createHistoricalValidationRecord(input) {
  input = input || {};
  const provenance = Object.assign({
    sourceName: '',
    sourceType: HistoricalSourceClassification.UNKNOWN_PROVENANCE,
    sourceDate: '',
    referenceMethod: '',
    currencyContext: '',
    notes: ''
  }, input.provenance || {});

  return {
    styleReference: input.styleReference || '',
    inputs: compactObject(input.inputs || {}),
    reference: compactObject(input.reference || {}),
    provenance
  };
}

function normalizeHistoricalValidationRecord(raw, sourceDefinition) {
  raw = raw || {};
  sourceDefinition = sourceDefinition || {};
  const fields = sourceDefinition.fields || {};

  function readField(name) {
    const sourceKey = fields[name] || name;
    return raw[sourceKey];
  }

  const inputs = {};
  [
    'fob', 'fob1', 'fob2', 'fob3', 'fob_closed', 'fobClosed', 'pvp_rub',
    'retail', 'currency', 'weight', 'units', 'quantity', 'origin',
    'destination', 'cat', 'category', 'department', 'transport',
    'transportMode', 'target_imu', 'targetImu', 'fsd', 'hod'
  ].forEach((key) => {
    const value = readField(key);
    if (value !== undefined && value !== null && value !== '') inputs[key] = value;
  });

  const reference = {};
  [
    'landedCost', 'ldp', 'imu', 'markup', 'targetFob',
    'freightPerUnit', 'duty', 'transitDays'
  ].forEach((key) => {
    const value = normalizeReferenceValue(key, readField('reference_' + key));
    if (value !== null) reference[key] = value;
  });

  return createHistoricalValidationRecord({
    styleReference: readField('styleReference') || readField('style_ref') || raw.styleReference || '',
    inputs,
    reference,
    provenance: Object.assign({}, sourceDefinition.provenance || {}, raw.provenance || {})
  });
}

function compareValidationField(args) {
  const referenceValue = args.referenceValue;
  const modelValue = args.modelValue;
  const tolerance = args.tolerance;
  const roundingTolerance = args.roundingTolerance;

  if (referenceValue === null || referenceValue === undefined) {
    return { result: HistoricalValidationResult.REFERENCE_MISSING };
  }
  if (modelValue === null || modelValue === undefined || Number.isNaN(modelValue)) {
    return { result: HistoricalValidationResult.INPUT_MISSING };
  }

  const absoluteDifference = Math.abs(modelValue - referenceValue);
  const percentageDifference = referenceValue !== 0 ? absoluteDifference / Math.abs(referenceValue) : null;
  let result = HistoricalValidationResult.MISMATCH;
  if (absoluteDifference <= tolerance) result = HistoricalValidationResult.MATCH;
  else if (absoluteDifference <= roundingTolerance) result = HistoricalValidationResult.ROUNDING_ONLY;

  return {
    result,
    referenceValue,
    model001Value: modelValue,
    absoluteDifference,
    percentageDifference,
    likelyCause: result === HistoricalValidationResult.MISMATCH
      ? HistoricalMismatchCause.UNKNOWN
      : null
  };
}

function summarizeValidation(fields) {
  const summary = {
    totalComparisons: fields.length,
    exactMatches: 0,
    roundingOnlyMatches: 0,
    mismatches: 0,
    referenceMissing: 0,
    inputMissing: 0,
    maximumAbsoluteDifference: 0,
    averageAbsoluteDifference: 0,
    perOutput: {}
  };
  let diffTotal = 0;
  let diffCount = 0;

  fields.forEach((field) => {
    if (!summary.perOutput[field.field]) {
      summary.perOutput[field.field] = {
        comparisons: 0,
        exactMatches: 0,
        roundingOnlyMatches: 0,
        mismatches: 0,
        referenceMissing: 0,
        inputMissing: 0,
        maximumAbsoluteDifference: 0
      };
    }
    const bucket = summary.perOutput[field.field];
    bucket.comparisons += 1;

    if (field.result === HistoricalValidationResult.MATCH) {
      summary.exactMatches += 1;
      bucket.exactMatches += 1;
    } else if (field.result === HistoricalValidationResult.ROUNDING_ONLY) {
      summary.roundingOnlyMatches += 1;
      bucket.roundingOnlyMatches += 1;
    } else if (field.result === HistoricalValidationResult.MISMATCH) {
      summary.mismatches += 1;
      bucket.mismatches += 1;
    } else if (field.result === HistoricalValidationResult.REFERENCE_MISSING) {
      summary.referenceMissing += 1;
      bucket.referenceMissing += 1;
    } else if (field.result === HistoricalValidationResult.INPUT_MISSING) {
      summary.inputMissing += 1;
      bucket.inputMissing += 1;
    }

    if (typeof field.absoluteDifference === 'number') {
      diffTotal += field.absoluteDifference;
      diffCount += 1;
      summary.maximumAbsoluteDifference = Math.max(summary.maximumAbsoluteDifference, field.absoluteDifference);
      bucket.maximumAbsoluteDifference = Math.max(bucket.maximumAbsoluteDifference, field.absoluteDifference);
    }
  });

  summary.averageAbsoluteDifference = diffCount ? diffTotal / diffCount : 0;
  return summary;
}

function validateCostModel001(records, options) {
  options = options || {};
  const costingDomain = options.costingDomain;
  if (!costingDomain || typeof costingDomain.evaluateModel001 !== 'function') {
    throw new Error('validateCostModel001 requires costingDomain.evaluateModel001');
  }

  const tolerances = Object.assign({}, DEFAULT_COST_MODEL_001_TOLERANCES, options.tolerances || {});
  const configuration = options.configuration || costingDomain.createModel001Configuration();
  const fieldMap = Object.assign({}, DEFAULT_FIELD_MAP, options.fieldMap || {});
  const styleResults = [];
  const fieldResults = [];

  (records || []).forEach((record) => {
    const normalized = createHistoricalValidationRecord(record);
    const modelResult = costingDomain.evaluateModel001(normalized.inputs, configuration);
    const fields = [];

    Object.keys(fieldMap).forEach((fieldName) => {
      const mapping = fieldMap[fieldName];
      const referenceValue = Object.prototype.hasOwnProperty.call(normalized.reference, fieldName)
        ? normalized.reference[fieldName]
        : null;
      const modelValue = modelResult ? modelResult[mapping.outputKey] : null;
      const baseTolerance = tolerances[mapping.tolerance] != null ? tolerances[mapping.tolerance] : tolerances.exact;
      const fieldComparison = Object.assign({
        styleReference: normalized.styleReference,
        field: fieldName,
        tolerance: baseTolerance
      }, compareValidationField({
        referenceValue,
        modelValue,
        tolerance: baseTolerance,
        roundingTolerance: Math.max(baseTolerance, baseTolerance * 10)
      }));
      fields.push(fieldComparison);
      fieldResults.push(fieldComparison);
    });

    styleResults.push({
      styleReference: normalized.styleReference,
      provenance: normalized.provenance,
      fields
    });
  });

  const summary = summarizeValidation(fieldResults);
  summary.records = (records || []).length;
  summary.recordsFullyEvaluable = styleResults.filter((style) => style.fields.every((field) => (
    field.result === HistoricalValidationResult.MATCH ||
    field.result === HistoricalValidationResult.ROUNDING_ONLY ||
    field.result === HistoricalValidationResult.MISMATCH
  ))).length;
  summary.matchRate = summary.totalComparisons
    ? (summary.exactMatches + summary.roundingOnlyMatches) / summary.totalComparisons
    : 0;

  return {
    status: 'HISTORICAL_VALIDATION_RUNNER_READY',
    tolerances,
    summary,
    styles: styleResults
  };
}

function classifyHistoricalSource(source) {
  source = source || {};
  if (source.classification) return source.classification;
  if (!source.exists) return HistoricalSourceClassification.UNUSABLE;
  if (source.synthetic) return HistoricalSourceClassification.SYNTHETIC;
  if (source.derivedFromCurrentRuntime) return HistoricalSourceClassification.DERIVED_FROM_CURRENT_CM;
  if (source.hasIndependentReferenceOutputs && source.provenanceVerified) {
    return HistoricalSourceClassification.INDEPENDENT_REFERENCE;
  }
  return HistoricalSourceClassification.UNKNOWN_PROVENANCE;
}

module.exports = {
  HistoricalSourceClassification,
  HistoricalValidationResult,
  HistoricalMismatchCause,
  DEFAULT_COST_MODEL_001_TOLERANCES,
  DEFAULT_FIELD_MAP,
  createHistoricalValidationRecord,
  normalizeHistoricalValidationRecord,
  validateCostModel001,
  classifyHistoricalSource
};
