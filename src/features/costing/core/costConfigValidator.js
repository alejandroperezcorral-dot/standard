(function(root){
  'use strict';

  var core=root.CostModel001Core||(typeof require==='function'?require('./costModel001.js'):null);
  var MODEL_CODE='cost-model-001';
  var FORMULA_VERSION=1;
  var ALLOWED_BASE_KEYS={
    id:true,
    version:true,
    formulaVersion:true,
    configurationVersion:true,
    name:true,
    status:true,
    source:true,
    assumptions:true,
    freightRoutes:true,
    dutyRows:true,
    dutyOverrides:true,
    fixedCosts:true,
    percentageCosts:true,
    transit:true,
    variables:true,
    scopes:true,
    resolutionTrace:true,
    context:true
  };
  var ALLOWED_OVERRIDE_VALUE_KEYS={fixedDuty:true,dutyPercent:true,loadNorm:true};
  var ALLOWED_COMPONENT_TYPES={FIXED_PER_UNIT:true,PERCENTAGE:true};
  var ALLOWED_PERCENTAGE_BASIS={FOB:true,LANDED_COST:true};

  function isPlainObject(value){
    return !!value&&typeof value==='object'&&!Array.isArray(value);
  }

  function pushError(errors,code,field){
    errors.push({code:code,field:field||null});
  }

  function isFiniteNumber(value){
    return typeof value==='number'&&isFinite(value);
  }

  function validateNumber(value,meta,field,errors){
    if(!isFiniteNumber(value)){
      pushError(errors,'INVALID_NUMBER',field);
      return;
    }
    var validation=(meta&&meta.validation)||{};
    if(validation.min!=null&&value<validation.min)pushError(errors,'NUMBER_BELOW_MIN',field);
    if(validation.max!=null&&value>validation.max)pushError(errors,'NUMBER_ABOVE_MAX',field);
  }

  function validateText(value,meta,field,errors){
    if(typeof value!=='string'){
      pushError(errors,'INVALID_TEXT',field);
      return;
    }
    var validation=(meta&&meta.validation)||{};
    if(validation.required&&String(value).trim()==='')pushError(errors,'TEXT_REQUIRED',field);
  }

  function validateKnownKeys(object,allowed,prefix,errors){
    Object.keys(object||{}).forEach(function(key){
      if(!allowed[key])pushError(errors,'UNKNOWN_KEY',prefix?prefix+'.'+key:key);
    });
  }

  function variableMetadataByKey(){
    var map={};
    if(!core||!core.getCostModel001VariableMetadata){
      return map;
    }
    (core.getCostModel001VariableMetadata?core.getCostModel001VariableMetadata():[]).forEach(function(meta){
      map[meta.key]=meta;
    });
    return map;
  }

  function validateAssumptions(assumptions,errors){
    if(!isPlainObject(assumptions)){
      pushError(errors,'INVALID_OBJECT','base_config.assumptions');
      return;
    }
    var metaByKey=variableMetadataByKey();
    validateKnownKeys(assumptions,metaByKey,'base_config.assumptions',errors);
    Object.keys(metaByKey).forEach(function(key){
      if(!Object.prototype.hasOwnProperty.call(assumptions,key)){
        pushError(errors,'REQUIRED_KEY_MISSING','base_config.assumptions.'+key);
        return;
      }
      var meta=metaByKey[key];
      var value=assumptions[key];
      if(meta.type==='text')validateText(value,meta,'base_config.assumptions.'+key,errors);
      else validateNumber(value,meta,'base_config.assumptions.'+key,errors);
    });
  }

  function validateFreightRoutes(routes,errors){
    if(!isPlainObject(routes)){
      pushError(errors,'INVALID_OBJECT','base_config.freightRoutes');
      return;
    }
    Object.keys(routes).forEach(function(key){
      var route=routes[key];
      if(!isPlainObject(route)){
        pushError(errors,'INVALID_OBJECT','base_config.freightRoutes.'+key);
        return;
      }
      validateKnownKeys(route,{cost:true,days:true},'base_config.freightRoutes.'+key,errors);
      validateNumber(route.cost,{validation:{min:0}},'base_config.freightRoutes.'+key+'.cost',errors);
      validateNumber(route.days,{validation:{min:0}},'base_config.freightRoutes.'+key+'.days',errors);
    });
  }

  function validateDutyRows(rows,errors){
    if(!Array.isArray(rows)){
      pushError(errors,'INVALID_ARRAY','base_config.dutyRows');
      return;
    }
    rows.forEach(function(row,index){
      var field='base_config.dutyRows['+index+']';
      if(!isPlainObject(row)){
        pushError(errors,'INVALID_OBJECT',field);
        return;
      }
      validateKnownKeys(row,{country:true,dept:true,cat:true,fixed:true,pct:true,load_norm:true},field,errors);
      validateText(row.country,{validation:{required:true}},field+'.country',errors);
      if(Object.prototype.hasOwnProperty.call(row,'dept'))validateText(row.dept,{validation:{required:true}},field+'.dept',errors);
      validateText(row.cat,{validation:{required:true}},field+'.cat',errors);
      validateNumber(row.fixed,{validation:{min:0}},field+'.fixed',errors);
      validateNumber(row.pct,{validation:{min:0}},field+'.pct',errors);
      validateNumber(row.load_norm,{validation:{min:0}},field+'.load_norm',errors);
    });
  }

  function validateBaseConfig(baseConfig,errors){
    if(!isPlainObject(baseConfig)){
      pushError(errors,'INVALID_OBJECT','base_config');
      return;
    }
    validateKnownKeys(baseConfig,ALLOWED_BASE_KEYS,'base_config',errors);
    if(baseConfig.id&&baseConfig.id!==MODEL_CODE)pushError(errors,'INVALID_MODEL_CODE','base_config.id');
    if(baseConfig.formulaVersion!=null&&baseConfig.formulaVersion!==FORMULA_VERSION)pushError(errors,'INVALID_FORMULA_VERSION','base_config.formulaVersion');
    if(baseConfig.version!=null&&baseConfig.version!==FORMULA_VERSION)pushError(errors,'INVALID_FORMULA_VERSION','base_config.version');
    validateAssumptions(baseConfig.assumptions,errors);
    validateFreightRoutes(baseConfig.freightRoutes||{},errors);
    validateDutyRows(baseConfig.dutyRows||[],errors);
    if(baseConfig.fixedCosts!=null&&!isPlainObject(baseConfig.fixedCosts))pushError(errors,'INVALID_OBJECT','base_config.fixedCosts');
    if(baseConfig.percentageCosts!=null&&!isPlainObject(baseConfig.percentageCosts))pushError(errors,'INVALID_OBJECT','base_config.percentageCosts');
    if(baseConfig.transit!=null&&!isPlainObject(baseConfig.transit))pushError(errors,'INVALID_OBJECT','base_config.transit');
  }

  function normalizeScope(value,normalizer){
    return normalizer(value||'');
  }

  function validateOverrideValues(values,prefix,errors){
    if(!isPlainObject(values)){
      pushError(errors,'INVALID_OBJECT',prefix);
      return;
    }
    validateKnownKeys(values,ALLOWED_OVERRIDE_VALUE_KEYS,prefix,errors);
    if(Object.prototype.hasOwnProperty.call(values,'fixedDuty'))validateNumber(values.fixedDuty,{validation:{min:0}},prefix+'.fixedDuty',errors);
    if(Object.prototype.hasOwnProperty.call(values,'dutyPercent'))validateNumber(values.dutyPercent,{validation:{min:0}},prefix+'.dutyPercent',errors);
    if(Object.prototype.hasOwnProperty.call(values,'loadNorm'))validateNumber(values.loadNorm,{validation:{min:0}},prefix+'.loadNorm',errors);
  }

  function validateOverrides(overrides,errors){
    if(!Array.isArray(overrides)){
      pushError(errors,'INVALID_ARRAY','overrides');
      return [];
    }
    var seen={};
    return overrides.map(function(row,index){
      var season=normalizeScope(row&&row.season_key,core.normalizeCostModelSeason);
      var origin=normalizeScope(row&&row.origin_key,core.normalizeCostModelOrigin);
      var category=normalizeScope(row&&row.category_key,core.normalizeCostModelScopeText);
      var field='overrides['+index+']';
      if(!season)pushError(errors,'SCOPE_REQUIRED',field+'.season_key');
      if(!origin)pushError(errors,'SCOPE_REQUIRED',field+'.origin_key');
      if(!category)pushError(errors,'SCOPE_REQUIRED',field+'.category_key');
      var key=season+'|'+origin+'|'+category;
      if(seen[key])pushError(errors,'DUPLICATE_SCOPE',field);
      seen[key]=true;
      validateOverrideValues((row&&row.values)||{},field+'.values',errors);
      return {
        season_key:season,
        origin_key:origin,
        category_key:category,
        values:(row&&row.values)||{}
      };
    });
  }

  function validateComponents(components,errors){
    if(!Array.isArray(components)){
      pushError(errors,'INVALID_ARRAY','additional_components');
      return [];
    }
    return components.map(function(row,index){
      var field='additional_components['+index+']';
      var enabled=!!(row&&row.enabled);
      if(!isPlainObject(row)){
        pushError(errors,'INVALID_OBJECT',field);
        return {};
      }
      if(!row.name||String(row.name).trim()==='')pushError(errors,'TEXT_REQUIRED',field+'.name');
      if(!ALLOWED_COMPONENT_TYPES[row.calculation_type])pushError(errors,'UNSUPPORTED_ADDITIONAL_COMPONENT',field+'.calculation_type');
      validateNumber(row.value,{validation:{min:0}},field+'.value',errors);
      if(row.percentage_basis&& !ALLOWED_PERCENTAGE_BASIS[row.percentage_basis])pushError(errors,'UNSUPPORTED_ADDITIONAL_COMPONENT',field+'.percentage_basis');
      if(enabled)pushError(errors,'UNSUPPORTED_ADDITIONAL_COMPONENT',field);
      return {
        name:String(row.name||'').trim(),
        calculation_type:row.calculation_type||null,
        value:row.value,
        currency:row.currency||null,
        percentage_basis:row.percentage_basis||null,
        enabled:enabled,
        season_key:normalizeScope(row.season_key,core.normalizeCostModelSeason)||null,
        origin_key:normalizeScope(row.origin_key,core.normalizeCostModelOrigin)||null,
        category_key:normalizeScope(row.category_key,core.normalizeCostModelScopeText)||null
      };
    });
  }

  function validateCostConfiguration(input){
    input=input||{};
    var errors=[];
    if(!core||!core.getCostModel001VariableMetadata){
      pushError(errors,'COSTING_RUNTIME_UNAVAILABLE','runtime');
      return {
        valid:false,
        modelCode:MODEL_CODE,
        formulaVersion:FORMULA_VERSION,
        errors:errors
      };
    }
    var modelCode=input.modelCode||input.model_code||MODEL_CODE;
    var formulaVersion=Object.prototype.hasOwnProperty.call(input,'formulaVersion')
      ?input.formulaVersion
      :input.formula_version;
    if(modelCode!==MODEL_CODE)pushError(errors,'INVALID_MODEL_CODE','modelCode');
    if(formulaVersion!==FORMULA_VERSION)pushError(errors,'INVALID_FORMULA_VERSION','formulaVersion');
    validateBaseConfig(input.baseConfig||input.base_config||{},errors);
    validateOverrides(input.overrides||[],errors);
    validateComponents(input.additionalComponents||input.additional_components||[],errors);
    return {
      valid:errors.length===0,
      modelCode:MODEL_CODE,
      formulaVersion:FORMULA_VERSION,
      errors:errors
    };
  }

  var api={
    MODEL_CODE:MODEL_CODE,
    FORMULA_VERSION:FORMULA_VERSION,
    validateCostConfiguration:validateCostConfiguration
  };

  root.CostConfigValidator=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
