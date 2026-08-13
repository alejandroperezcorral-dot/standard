function normalizeCostingInput(style,context){
  style=style||{};context=context||{};
  return {
    styleId:style.id||style.styleId||null,
    supplier:style.supplier||'',
    origin:style.origin||'',
    fob:style.fob_closed||style.fob3||style.fob2||style.fob1||style.fob||null,
    currency:style.currency||context.currency||'USD',
    quantity:style.units||style.quantity||null,
    category:style.cat||style.category||'',
    weight:style.weight||null,
    cbm:style.cbm||null,
    destination:context.destination||'',
    transportMode:style.transport||context.transportMode||'',
    incoterm:style.incoterm||context.incoterm||'FOB'
  };
}
function createCostingService(connector){
  var activeConnector=normalizeCostConnector(connector);
  return {
    estimate:function(style,context){
      var input=normalizeCostingInput(style,context);
      return activeConnector.estimate(input);
    },
    enrichStyle:function(style,context){
      var input=normalizeCostingInput(style,context);
      var result=activeConnector.estimate(input);
      return {
        style:style,
        costingInput:input,
        costingResult:result
      };
    }
  };
}
