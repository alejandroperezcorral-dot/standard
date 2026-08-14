function normalizeCostingInput(style,context){
  if(typeof CostModel001Core!=='undefined'&&CostModel001Core&&typeof CostModel001Core.normalizeCostingInput==='function'){
    return CostModel001Core.normalizeCostingInput(style,context);
  }
  style=style||{};context=context||{};
  return {
    styleId:style.id||style.styleId||null,
    supplier:style.supplier||'',
    origin:style.origin||'',
    transport:style.transport||context.transportMode||'',
    transportMode:style.transport||context.transportMode||'',
    temporada:style.temporada||style.season||'',
    season:style.temporada||style.season||'',
    dept:style.dept||style.department||'',
    department:style.dept||style.department||'',
    cat:style.cat||style.category||'',
    category:style.cat||style.category||'',
    pvp_rub:style.pvp_rub,
    fob1:style.fob1,
    fob2:style.fob2,
    fob3:style.fob3,
    fob_closed:style.fob_closed,
    fob:style.fob_closed||style.fob3||style.fob2||style.fob1||style.fob||0,
    target_imu:style.target_imu!=null?style.target_imu:style.targetImu,
    targetImu:style.target_imu!=null?style.target_imu:style.targetImu,
    currency:style.currency||context.currency||'USD',
    units:style.units||style.quantity,
    quantity:style.units||style.quantity,
    weight:style.weight,
    cbm:style.cbm||null,
    fsd:style.fsd||'',
    hod:style.hod||'',
    destination:context.destination||'',
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
