var CostModel001Core=CostModel001Core||((typeof globalThis!=='undefined')?globalThis.CostModel001Core:null);
if(!CostModel001Core)throw new Error('CostModel001Core is required before costModel.js');

var CostModel001Status=CostModel001Core.CostModel001Status;
var COST_MODEL_001_ID=CostModel001Core.COST_MODEL_001_ID;
var COST_MODEL_001_VERSION=CostModel001Core.COST_MODEL_001_VERSION;
var COST_MODEL_001_CONFIGURATION_CURRENT=CostModel001Core.COST_MODEL_001_CONFIGURATION_CURRENT;
var COST_MODEL_001_CONFIGURATION_FW26=CostModel001Core.COST_MODEL_001_CONFIGURATION_FW26;
var COST_MODEL_001_DEFAULT_ASSUMPTIONS=CostModel001Core.COST_MODEL_001_DEFAULT_ASSUMPTIONS;

var createCostModelMetadata=CostModel001Core.createCostModelMetadata;
var cloneCostModelValue=CostModel001Core.cloneCostModelValue;
var normalizeCostModelScopeText=CostModel001Core.normalizeCostModelScopeText;
var normalizeCostModelOrigin=CostModel001Core.normalizeCostModelOrigin;
var normalizeCostModelSeason=CostModel001Core.normalizeCostModelSeason;
var createCostModel001Fw26DutyOverrides=CostModel001Core.createCostModel001Fw26DutyOverrides;
var createCostModel001Configuration=CostModel001Core.createCostModel001Configuration;
var resolveCostModelConfiguration=CostModel001Core.resolveCostModelConfiguration;
var getCostModel001VariableMetadata=CostModel001Core.getCostModel001VariableMetadata;
var costModel001FreightPerUnit=CostModel001Core.costModel001FreightPerUnit;
var costModel001DutyFor=CostModel001Core.costModel001DutyFor;
var evaluateCostModel001=CostModel001Core.evaluateCostModel001;

function createCostModel001Connector(options){
  options=options||{};
  var configuration=resolveCostModelConfiguration({model:options.configuration||createCostModel001Configuration(options)});
  var metadata=createCostModelMetadata(Object.assign({
    version:COST_MODEL_001_VERSION,
    status:CostModel001Status.CHARACTERIZED,
    assumptions:configuration.assumptions
  },options.metadata||{}));
  return {
    source:metadata.source,
    metadata:metadata,
    estimate:function(input){
      var result=typeof options.calculate==='function'
        ?options.calculate(input,metadata)
        :evaluateCostModel001(input,configuration);
      return createCostingResult(Object.assign({},result||{},{
        estimatedLandedCost:result&&result.estimatedLandedCost!=null?result.estimatedLandedCost:result&&result.landedCost,
        source:result&&result.source?result.source:metadata.source,
        costModelId:metadata.costModelId,
        costModelVersion:metadata.version,
        breakdown:result&&result.breakdown?result.breakdown:result
      }));
    }
  };
}
