function createNoCostConnector(){
  return {
    source:CostingSourceType.NONE,
    estimate:function(){
      return createNoCostingResult('No costing connector configured');
    }
  };
}
function normalizeCostConnector(connector){
  if(connector&&typeof connector.estimate==='function')return connector;
  return createNoCostConnector();
}
