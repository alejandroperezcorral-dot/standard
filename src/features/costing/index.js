var CostingDomain={
  status:CostingResultStatus,
  sourceType:CostingSourceType,
  createResult:createCostingResult,
  createNoResult:createNoCostingResult,
  createNoConnector:createNoCostConnector,
  normalizeConnector:normalizeCostConnector,
  createModelMetadata:createCostModelMetadata,
  createModel001Configuration:createCostModel001Configuration,
  resolveModelConfiguration:resolveCostModelConfiguration,
  getModel001VariableMetadata:getCostModel001VariableMetadata,
  evaluateModel001:evaluateCostModel001,
  createModel001Connector:createCostModel001Connector,
  normalizeInput:normalizeCostingInput,
  createService:createCostingService
};
