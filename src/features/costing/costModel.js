function createCostModelMetadata(input){
  input=input||{};
  return {
    costModelId:input.costModelId||'cost-model-001',
    name:input.name||'Cost Model 001',
    version:input.version||'0.1.0',
    status:input.status||'DESIGN_ONLY',
    source:input.source||CostingSourceType.STDTEX_COST_MODEL,
    effectiveFrom:input.effectiveFrom||null,
    assumptions:input.assumptions||{}
  };
}
function createCostModel001Connector(options){
  options=options||{};
  var metadata=createCostModelMetadata(options.metadata||{});
  return {
    source:metadata.source,
    metadata:metadata,
    estimate:function(input){
      if(typeof options.calculate!=='function'){
        return createNoCostingResult('Cost Model 001 has no validated calculation function yet');
      }
      var result=options.calculate(input,metadata);
      return createCostingResult(Object.assign({},result||{},{
        source:result&&result.source?result.source:metadata.source,
        costModelId:metadata.costModelId,
        costModelVersion:metadata.version
      }));
    }
  };
}
