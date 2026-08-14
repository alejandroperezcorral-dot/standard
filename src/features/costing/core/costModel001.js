(function(root){
  'use strict';

  var CostModel001Status={
    CHARACTERIZED:'CHARACTERIZED',
    HISTORICALLY_VALIDATED:'HISTORICALLY_VALIDATED'
  };
  var COST_MODEL_001_ID='cost-model-001';
  var COST_MODEL_001_VERSION=1;
  var COST_MODEL_001_CONFIGURATION_CURRENT='CURRENT';
  var COST_MODEL_001_CONFIGURATION_FW26='FW26';
  var workbookDefaults=root.CostModel001WorkbookDefaults||{assumptions:{},freightRoutes:{},dutyRows:[]};
  var COST_MODEL_001_DEFAULT_ASSUMPTIONS={
    insuranceRate:0.003,
    grossWeightUplift:0.11,
    rubExchangeRate:87,
    eurExchangeRate:1.16,
    vatRate:0.2,
    targetImu:0.72,
    fallbackDutyRate:0.13,
    defaultOrigin:'BANGLADESH',
    defaultTransportMode:'SEA-TRUCK'
  };
  COST_MODEL_001_DEFAULT_ASSUMPTIONS=Object.assign({},COST_MODEL_001_DEFAULT_ASSUMPTIONS,workbookDefaults.assumptions||{});
  var COST_MODEL_001_DEFAULT_FREIGHT_ROUTES=workbookDefaults.freightRoutes||{};
  var COST_MODEL_001_DEFAULT_DUTY_ROWS=workbookDefaults.dutyRows||[];
  var COST_MODEL_001_FW26_DUTY_OVERRIDES=[
    {
      id:'fw26-vietnam-pants-commercial-duty',
      scope:{origin:'VIETNAM',category:'Pants Commercial'},
      period:{season:COST_MODEL_001_CONFIGURATION_FW26},
      values:{fixedDuty:2.2,dutyPercent:0},
      source:'FW26 Duty Calculator GJ row 300'
    },
    {
      id:'fw26-vietnam-jct-nondenim-duty',
      scope:{origin:'VIETNAM',category:'Jct Nondenim'},
      period:{season:COST_MODEL_001_CONFIGURATION_FW26},
      values:{fixedDuty:2.25,dutyPercent:0.1},
      source:'FW26 Duty Calculator GJ row 290'
    },
    {
      id:'fw26-bangladesh-jeans-color-duty',
      scope:{origin:'BANGLADESH',category:'Jeans Color'},
      period:{season:COST_MODEL_001_CONFIGURATION_FW26},
      values:{fixedDuty:1.9,dutyPercent:0.1},
      source:'FW26 Duty Calculator GJ row 67'
    }
  ];
  var COST_MODEL_001_VARIABLES=[
    {key:'insuranceRate',label:'Insurance',description:'FOB insurance uplift applied before landed cost.',type:'percentage',unit:'%',defaultValue:0.003,editable:true,scope:'model-default',category:'GENERAL',validation:{min:0}},
    {key:'grossWeightUplift',label:'Gross Weight Uplift',description:'Net-to-gross weight uplift used for units-per-container calculations.',type:'percentage',unit:'%',defaultValue:0.11,editable:true,scope:'model-default',category:'LOGISTICS',validation:{min:0}},
    {key:'rubExchangeRate',label:'RUB Exchange Rate',description:'RUB per USD used to convert net retail price into USD.',type:'rate',unit:'RUB/USD',defaultValue:87,editable:true,scope:'model-default',category:'GENERAL',validation:{min:0}},
    {key:'eurExchangeRate',label:'EUR Exchange Rate',description:'USD per EUR used for fixed duty conversion.',type:'rate',unit:'USD/EUR',defaultValue:1.16,editable:true,scope:'model-default',category:'GENERAL',validation:{min:0}},
    {key:'vatRate',label:'VAT',description:'Retail tax removed from PVP before IMU calculation.',type:'percentage',unit:'%',defaultValue:0.2,editable:true,scope:'model-default',category:'GENERAL',validation:{min:0}},
    {key:'targetImu',label:'Target IMU',description:'Default target IMU when a style does not provide its own target.',type:'percentage',unit:'%',defaultValue:0.72,editable:true,scope:'model-default',category:'GENERAL',validation:{min:-10,max:1}},
    {key:'fallbackDutyRate',label:'Fallback Duty',description:'Percentage duty used when an origin exists but no exact category duty row matches.',type:'percentage',unit:'%',defaultValue:0.13,editable:true,scope:'model-default',category:'DUTIES',validation:{min:0}},
    {key:'defaultOrigin',label:'Default Origin',description:'Origin used when a style does not provide one.',type:'text',unit:null,defaultValue:'BANGLADESH',editable:true,scope:'model-default',category:'GENERAL',validation:{required:true}},
    {key:'defaultTransportMode',label:'Default Transport Mode',description:'Transport mode used when a style does not provide one.',type:'text',unit:null,defaultValue:'SEA-TRUCK',editable:true,scope:'model-default',category:'LOGISTICS',validation:{required:true}},
    {key:'aedExchangeRate',label:'AED Exchange Rate',description:'AED per USD from the Model 001 control panel.',type:'rate',unit:'AED/USD',defaultValue:3.67,editable:true,scope:'model-default',category:'CURRENCY',validation:{min:0}},
    {key:'rmbExchangeRate',label:'RMB Exchange Rate',description:'RMB per USD from the Model 001 control panel.',type:'rate',unit:'RMB/USD',defaultValue:7.1,editable:true,scope:'model-default',category:'CURRENCY',validation:{min:0}},
    {key:'seaRailroadContainerSize',label:'Sea/Railroad Container Size',description:'Container sizing assumption from the Model 001 control panel.',type:'number',unit:null,defaultValue:76,editable:true,scope:'model-default',category:'LOGISTICS',validation:{min:0}},
    {key:'truckContainerSize',label:'Truck Container Size',description:'Truck sizing assumption from the Model 001 control panel.',type:'number',unit:null,defaultValue:82,editable:true,scope:'model-default',category:'LOGISTICS',validation:{min:0}},
    {key:'optimizationRatio',label:'Optimization Ratio',description:'Container optimization ratio from the Model 001 control panel.',type:'percentage',unit:'%',defaultValue:0.8,editable:true,scope:'model-default',category:'LOGISTICS',validation:{min:0}},
    {key:'successClothesRate',label:'Success Clothes',description:'Success ratio for clothes from the Model 001 control panel.',type:'percentage',unit:'%',defaultValue:0.7,editable:true,scope:'model-default',category:'GENERAL',validation:{min:0}},
    {key:'successShoesRate',label:'Success Shoes',description:'Success ratio for shoes from the Model 001 control panel.',type:'percentage',unit:'%',defaultValue:0.7,editable:true,scope:'model-default',category:'GENERAL',validation:{min:0}}
  ];

  function cloneCostModelValue(value){
    if(value==null||typeof value!=='object')return value;
    return JSON.parse(JSON.stringify(value));
  }
  function normalizeCostModelScopeText(value){
    return value==null?'':String(value).trim();
  }
  function normalizeCostModelOrigin(value){
    return normalizeCostModelScopeText(value).toUpperCase();
  }
  function normalizeCostModelSeason(value){
    return normalizeCostModelScopeText(value).toUpperCase();
  }
  function normalizeCostingContext(input){
    input=input||{};
    var category=input.category!=null?input.category:input.cat;
    var department=input.department!=null?input.department:input.dept;
    var season=input.season!=null?input.season:input.temporada;
    return {
      season:season==null?null:normalizeCostModelSeason(season),
      department:department==null?null:normalizeCostModelScopeText(department),
      category:category==null?null:normalizeCostModelScopeText(category),
      origin:input.origin==null?null:normalizeCostModelOrigin(input.origin)
    };
  }
  function normalizeCostingInput(style,context){
    style=style||{};
    context=context||{};
    var category=style.cat!=null?style.cat:style.category;
    var department=style.dept!=null?style.dept:style.department;
    var season=style.temporada!=null?style.temporada:style.season;
    var origin=style.origin!=null?style.origin:context.origin;
    var transport=style.transport!=null?style.transport:(style.transportMode!=null?style.transportMode:context.transportMode);
    var units=style.units!=null?style.units:style.quantity;
    var targetImu=style.target_imu!=null?style.target_imu:style.targetImu;
    var fob=style.fob_closed||style.fob3||style.fob2||style.fob1||style.fob||0;
    return {
      styleId:style.id||style.styleId||null,
      supplier:style.supplier||'',
      origin:origin||'',
      transport:transport||'',
      transportMode:transport||'',
      temporada:season||'',
      season:season||'',
      dept:department||'',
      department:department||'',
      cat:category||'',
      category:category||'',
      pvp_rub:style.pvp_rub,
      fob1:style.fob1,
      fob2:style.fob2,
      fob3:style.fob3,
      fob_closed:style.fob_closed,
      fob:fob,
      target_imu:targetImu,
      targetImu:targetImu,
      units:units,
      quantity:units,
      weight:style.weight,
      cbm:style.cbm||null,
      fsd:style.fsd||'',
      hod:style.hod||'',
      currency:style.currency||context.currency||'USD',
      destination:context.destination||'',
      incoterm:style.incoterm||context.incoterm||'FOB',
      context:normalizeCostingContext({
        season:season,
        department:department,
        category:category,
        origin:origin
      })
    };
  }
  function createCostModelMetadata(input){
    input=input||{};
    return {
      costModelId:input.costModelId||COST_MODEL_001_ID,
      name:input.name||'Cost Model 001',
      version:input.version||COST_MODEL_001_VERSION,
      status:input.status||CostModel001Status.CHARACTERIZED,
      source:input.source||'STDTEX_COST_MODEL',
      effectiveFrom:input.effectiveFrom||null,
      assumptions:input.assumptions||{}
    };
  }
  function createCostModel001Fw26DutyOverrides(){
    return cloneCostModelValue(COST_MODEL_001_FW26_DUTY_OVERRIDES);
  }
  function createCostModel001Configuration(overrides){
    overrides=overrides||{};
    return {
      id:COST_MODEL_001_ID,
      version:COST_MODEL_001_VERSION,
      formulaVersion:COST_MODEL_001_VERSION,
      configurationVersion:overrides.configurationVersion||COST_MODEL_001_CONFIGURATION_CURRENT,
      name:'Cost Model 001',
      status:CostModel001Status.CHARACTERIZED,
      source:'STDTEX_COST_MODEL',
      assumptions:Object.assign({},COST_MODEL_001_DEFAULT_ASSUMPTIONS,overrides.assumptions||{}),
      freightRoutes:cloneCostModelValue(Object.prototype.hasOwnProperty.call(overrides,'freightRoutes')?overrides.freightRoutes:COST_MODEL_001_DEFAULT_FREIGHT_ROUTES),
      dutyRows:cloneCostModelValue(Object.prototype.hasOwnProperty.call(overrides,'dutyRows')?overrides.dutyRows:COST_MODEL_001_DEFAULT_DUTY_ROWS),
      dutyOverrides:cloneCostModelValue(overrides.dutyOverrides||[]),
      fixedCosts:cloneCostModelValue(overrides.fixedCosts||{}),
      percentageCosts:cloneCostModelValue(overrides.percentageCosts||{}),
      transit:cloneCostModelValue(overrides.transit||{}),
      variables:COST_MODEL_001_VARIABLES.map(function(variable){
        var copy=Object.assign({},variable);
        copy.currentValue=overrides.values&&Object.prototype.hasOwnProperty.call(overrides.values,copy.key)
          ?overrides.values[copy.key]
          :Object.prototype.hasOwnProperty.call(COST_MODEL_001_DEFAULT_ASSUMPTIONS,copy.key)
            ?COST_MODEL_001_DEFAULT_ASSUMPTIONS[copy.key]
            :copy.defaultValue;
        if(Object.prototype.hasOwnProperty.call(COST_MODEL_001_DEFAULT_ASSUMPTIONS,copy.key))copy.defaultValue=COST_MODEL_001_DEFAULT_ASSUMPTIONS[copy.key];
        return copy;
      }),
      scopes:cloneCostModelValue(overrides.scopes||{}),
      resolutionTrace:cloneCostModelValue(overrides.resolutionTrace||[]),
      context:overrides.context?normalizeCostingContext(overrides.context):null
    };
  }
  function costModelPeriodMatches(overridePeriod,context){
    overridePeriod=overridePeriod||{};
    context=context||{};
    if(overridePeriod.season){
      return normalizeCostModelSeason(context.season)===normalizeCostModelSeason(overridePeriod.season);
    }
    return true;
  }
  function costModelDutyOverrideMatches(override,context){
    override=override||{};
    context=context||{};
    var scope=override.scope||{};
    if(scope.origin&&normalizeCostModelOrigin(context.origin)!==normalizeCostModelOrigin(scope.origin))return false;
    if(scope.category&&normalizeCostModelScopeText(context.category)!==normalizeCostModelScopeText(scope.category))return false;
    return costModelPeriodMatches(override.period,context);
  }
  function applyCostModel001DutyOverride(dutyRows,override){
    var rows=cloneCostModelValue(dutyRows||[]);
    var scope=override.scope||{};
    var values=override.values||{};
    var matched=false;
    for(var i=0;i<rows.length;i++){
      var row=rows[i];
      if(normalizeCostModelOrigin(row.country)===normalizeCostModelOrigin(scope.origin)&&normalizeCostModelScopeText(row.cat)===normalizeCostModelScopeText(scope.category)){
        if(Object.prototype.hasOwnProperty.call(values,'fixedDuty'))row.fixed=values.fixedDuty;
        if(Object.prototype.hasOwnProperty.call(values,'dutyPercent'))row.pct=values.dutyPercent;
        matched=true;
        break;
      }
    }
    if(!matched){
      rows.push({
        country:scope.origin,
        cat:scope.category,
        fixed:Object.prototype.hasOwnProperty.call(values,'fixedDuty')?values.fixedDuty:0,
        pct:Object.prototype.hasOwnProperty.call(values,'dutyPercent')?values.dutyPercent:0,
        load_norm:values.loadNorm||0
      });
    }
    return rows;
  }
  function resolveCostModelConfiguration(input){
    input=input||{};
    var model=input.model||createCostModel001Configuration(input);
    var context=normalizeCostingContext(input.context||input.calculationContext||{});
    var resolved=createCostModel001Configuration(model);
    if(model.assumptions)resolved.assumptions=Object.assign({},COST_MODEL_001_DEFAULT_ASSUMPTIONS,model.assumptions);
    resolved.freightRoutes=cloneCostModelValue(Object.prototype.hasOwnProperty.call(model,'freightRoutes')?model.freightRoutes:COST_MODEL_001_DEFAULT_FREIGHT_ROUTES);
    resolved.dutyRows=cloneCostModelValue(Object.prototype.hasOwnProperty.call(model,'dutyRows')?model.dutyRows:COST_MODEL_001_DEFAULT_DUTY_ROWS);
    resolved.dutyOverrides=cloneCostModelValue(model.dutyOverrides||[]);
    resolved.fixedCosts=cloneCostModelValue(model.fixedCosts||{});
    resolved.percentageCosts=cloneCostModelValue(model.percentageCosts||{});
    resolved.transit=cloneCostModelValue(model.transit||{});
    resolved.context=context;
    resolved.configurationVersion=normalizeCostModelSeason(context.season)===COST_MODEL_001_CONFIGURATION_FW26
      ?COST_MODEL_001_CONFIGURATION_FW26
      :model.configurationVersion||COST_MODEL_001_CONFIGURATION_CURRENT;
    resolved.resolutionTrace=[{
      step:'MODEL_DEFAULT',
      configurationVersion:model.configurationVersion||COST_MODEL_001_CONFIGURATION_CURRENT,
      matched:true
    }];
    for(var i=0;i<resolved.dutyOverrides.length;i++){
      var override=resolved.dutyOverrides[i];
      if(costModelDutyOverrideMatches(override,context)){
        resolved.dutyRows=applyCostModel001DutyOverride(resolved.dutyRows,override);
        resolved.resolutionTrace.push({
          step:'DUTY_OVERRIDE',
          id:override.id||null,
          scope:cloneCostModelValue(override.scope||{}),
          period:cloneCostModelValue(override.period||{}),
          source:override.source||null,
          matched:true
        });
      }
    }
    return resolved;
  }
  function getCostModel001VariableMetadata(){
    return COST_MODEL_001_VARIABLES.map(function(variable){return Object.assign({},variable);});
  }
  function costModel001FreightPerUnit(origin,transportMode,units,weight,category,department,configuration){
    if(configuration==null&&department&&typeof department==='object'){
      configuration=department;
      department='';
    }
    configuration=configuration||{};
    var assumptions=configuration.assumptions||{};
    var routes=configuration.freightRoutes||{};
    var dutyRows=configuration.dutyRows||[];
    var route=routes[origin+'|'+transportMode];
    if(!route)return{costPerUnit:0,days:0};
    if(!weight)return{costPerUnit:0,days:route.days};
    var unitsPerContainer=0;
    if(category){
      var countryTitle=origin.charAt(0).toUpperCase()+origin.slice(1).toLowerCase();
      var fallbackDuty=null;
      for(var i=0;i<dutyRows.length;i++){
        var duty=dutyRows[i];
        if(String(duty.country||'').toLowerCase()===countryTitle.toLowerCase()&&duty.cat===category&&duty.load_norm>0){
          if(department&&duty.dept&&String(duty.dept).toLowerCase()===String(department).toLowerCase()){
            unitsPerContainer=duty.load_norm/(weight*(1+assumptions.grossWeightUplift));
            break;
          }
          if(!fallbackDuty)fallbackDuty=duty;
        }
      }
      if(!unitsPerContainer&&fallbackDuty)unitsPerContainer=fallbackDuty.load_norm/(weight*(1+assumptions.grossWeightUplift));
    }
    if(!unitsPerContainer)return{costPerUnit:0,days:route.days};
    var containers=(units||1)/unitsPerContainer;
    return{costPerUnit:(route.cost*containers)/(units||1),days:route.days};
  }
  function costModel001DutyFor(origin,category,department,configuration){
    if(configuration==null&&department&&typeof department==='object'){
      configuration=department;
      department='';
    }
    configuration=configuration||{};
    if(!category)return{fixed:0,pct:0};
    var assumptions=configuration.assumptions||{};
    var dutyRows=configuration.dutyRows||[];
    var countryTitle=origin.charAt(0).toUpperCase()+origin.slice(1).toLowerCase();
    var best=null;
    for(var i=0;i<dutyRows.length;i++){
      var duty=dutyRows[i];
      if(String(duty.country||'').toLowerCase()===countryTitle.toLowerCase()){
        if(duty.cat===category){
          if(department&&duty.dept&&String(duty.dept).toLowerCase()===String(department).toLowerCase()){best=duty;break;}
          if(!best)best=duty;
        }
      }
    }
    return best?{fixed:best.fixed,pct:best.pct}:{fixed:0,pct:assumptions.fallbackDutyRate};
  }
  function evaluateCostModel001(input,resolvedConfiguration){
    input=input||{};
    var normalized=normalizeCostingInput(input,input.context||{});
    var configuration=resolvedConfiguration&&resolvedConfiguration.assumptions
      ?resolvedConfiguration
      :resolveCostModelConfiguration({model:resolvedConfiguration||{},context:normalized.context});
    var assumptions=configuration.assumptions||{};
    var fob=input.fob_closed||input.fob3||input.fob2||input.fob1||input.fob||0;
    var pvp=input.pvp_rub||0;
    var origin=input.origin||assumptions.defaultOrigin;
    var transport=input.transport||input.transportMode||assumptions.defaultTransportMode;
    var units=input.units||input.quantity||1;
    var weight=input.weight||0;
    var category=input.cat||input.category||'';
    var department=input.dept||input.department||'';
    var freight=costModel001FreightPerUnit(origin,transport,units,weight,category,department,configuration);
    var duty=costModel001DutyFor(origin,category,department,configuration);
    var fixedCustoms=weight?duty.fixed*assumptions.eurExchangeRate*weight:0;
    var percentageCustoms=fob*duty.pct;
    var customs=Math.max(fixedCustoms,percentageCustoms);
    var landedCost=fob*(1+assumptions.insuranceRate)+freight.costPerUnit+customs;
    var netRetailUsd=pvp/((1+(assumptions.vatRate||0.2))*assumptions.rubExchangeRate);
    var imu=netRetailUsd>0?(netRetailUsd-landedCost)/netRetailUsd:0;
    var markup=(imu<1&&imu>-10)?imu/(1-imu):0;
    var targetImu=input.target_imu||assumptions.targetImu;
    var gap=imu-targetImu;
    var targetFobFixed=netRetailUsd>0?(netRetailUsd*(1-targetImu)-freight.costPerUnit-fixedCustoms)/(1+assumptions.insuranceRate):0;
    var targetFobPct=netRetailUsd>0?(netRetailUsd*(1-targetImu)-freight.costPerUnit)/(1+assumptions.insuranceRate+duty.pct):0;
    var targetFob=(fixedCustoms>=duty.pct*Math.max(targetFobFixed,0))?targetFobFixed:targetFobPct;
    var customsPct=fob>0?customs/fob:0;
    return {
      fob:fob,
      selectedFob:fob,
      ldp:landedCost,
      landedCost:landedCost,
      pU:netRetailUsd,
      netRetailUsd:netRetailUsd,
      imu:imu,
      mu:markup,
      markup:markup,
      tgt:targetImu,
      targetImu:targetImu,
      gap:gap,
      fobT:targetFob,
      targetFob:targetFob,
      cu:freight.costPerUnit,
      freightPerUnit:freight.costPerUnit,
      cust:customs,
      duty:customs,
      custPct:customsPct,
      dutyRate:customsPct,
      days:freight.days,
      transitDays:freight.days,
      costBasis:'LANDED_COST',
      modelId:COST_MODEL_001_ID,
      modelVersion:COST_MODEL_001_VERSION,
      source:'STDTEX_COST_MODEL',
      status:'ESTIMATED',
      modelStatus:CostModel001Status.CHARACTERIZED,
      context:normalized.context
    };
  }

  var api={
    CostModel001Status:CostModel001Status,
    COST_MODEL_001_ID:COST_MODEL_001_ID,
    COST_MODEL_001_VERSION:COST_MODEL_001_VERSION,
    COST_MODEL_001_CONFIGURATION_CURRENT:COST_MODEL_001_CONFIGURATION_CURRENT,
    COST_MODEL_001_CONFIGURATION_FW26:COST_MODEL_001_CONFIGURATION_FW26,
    COST_MODEL_001_DEFAULT_ASSUMPTIONS:COST_MODEL_001_DEFAULT_ASSUMPTIONS,
    COST_MODEL_001_DEFAULT_FREIGHT_ROUTES:COST_MODEL_001_DEFAULT_FREIGHT_ROUTES,
    COST_MODEL_001_DEFAULT_DUTY_ROWS:COST_MODEL_001_DEFAULT_DUTY_ROWS,
    createCostModelMetadata:createCostModelMetadata,
    cloneCostModelValue:cloneCostModelValue,
    normalizeCostModelScopeText:normalizeCostModelScopeText,
    normalizeCostModelOrigin:normalizeCostModelOrigin,
    normalizeCostModelSeason:normalizeCostModelSeason,
    normalizeCostingContext:normalizeCostingContext,
    normalizeCostingInput:normalizeCostingInput,
    createCostModel001Fw26DutyOverrides:createCostModel001Fw26DutyOverrides,
    createCostModel001Configuration:createCostModel001Configuration,
    resolveCostModelConfiguration:resolveCostModelConfiguration,
    getCostModel001VariableMetadata:getCostModel001VariableMetadata,
    costModel001FreightPerUnit:costModel001FreightPerUnit,
    costModel001DutyFor:costModel001DutyFor,
    evaluateCostModel001:evaluateCostModel001
  };

  root.CostModel001Core=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
