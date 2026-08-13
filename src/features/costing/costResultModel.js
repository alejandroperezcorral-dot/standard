var CostingResultStatus={
  NOT_AVAILABLE:'NOT_AVAILABLE',
  ESTIMATED:'ESTIMATED',
  CONFIRMED:'CONFIRMED',
  STALE:'STALE',
  ERROR:'ERROR'
};
var CostingSourceType={
  NONE:'NONE',
  STDTEX_COST_MODEL:'STDTEX_COST_MODEL',
  ERP:'ERP',
  COMPANY_MODEL:'COMPANY_MODEL',
  CUSTOM_API:'CUSTOM_API',
  THIRD_PARTY:'THIRD_PARTY'
};
function createCostingResult(input){
  input=input||{};
  return {
    estimatedLandedCost:input.estimatedLandedCost==null?null:Number(input.estimatedLandedCost),
    currency:input.currency||'USD',
    status:input.status||CostingResultStatus.NOT_AVAILABLE,
    source:input.source||CostingSourceType.NONE,
    timestamp:input.timestamp||null,
    confidence:input.confidence==null?null:Number(input.confidence),
    breakdown:input.breakdown||null,
    costModelId:input.costModelId||null,
    costModelVersion:input.costModelVersion||null,
    errors:input.errors||[]
  };
}
function createNoCostingResult(reason){
  return createCostingResult({
    status:CostingResultStatus.NOT_AVAILABLE,
    source:CostingSourceType.NONE,
    errors:reason?[String(reason)]:[]
  });
}
