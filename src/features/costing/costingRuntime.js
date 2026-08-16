(function(root){
  'use strict';

  var activeConfigCache={};
  var activeConfigLoading={};

  function cacheKey(input){
    input=input||{};
    var id=input.companyId||'';
    if(id)return String(id).trim();
    return String(input.companyName||'').trim().toLowerCase();
  }

  function normalizeOverride(row){
    row=row||{};
    return {
      id:row.id,
      scope:{origin:row.origin_key,category:row.category_key},
      period:{season:row.season_key},
      values:row.values||{},
      source:row.source_reference||'Company override'
    };
  }

  function configurationFromData(domain,data){
    if(!domain||!data)return null;
    var settings=data.settings;
    if(!settings||settings.cost_source_type!=='STDTEX_MODEL'||!settings.active_config_version_id)return null;
    var versions=data.versions||[];
    var version=versions.filter(function(v){return v.id===settings.active_config_version_id;})[0]||null;
    if(!version||!version.base_config)return null;
    var overrides=(data.overrides||[]).map(normalizeOverride);
    return domain.createModel001Configuration(Object.assign({},version.base_config,{dutyOverrides:overrides}));
  }

  function state(input){
    input=input||{};
    var key=cacheKey(input);
    var data=key?activeConfigCache[key]:null;
    if(!key)return {status:'NOT_AVAILABLE',reason:'NO_COMPANY'};
    if(activeConfigLoading[key])return {status:'LOADING',reason:'COSTING_CONFIG_LOADING'};
    if(!data)return {status:'UNKNOWN',reason:'COSTING_CONFIG_NOT_LOADED'};
    if(data.error)return {status:'ERROR',reason:data.error};
    if(!data.settings)return {status:'NOT_AVAILABLE',reason:'NO_COMPANY_COSTING_SETTINGS'};
    if(data.settings.cost_source_type!=='STDTEX_MODEL')return {status:'NOT_AVAILABLE',reason:'FOB_ONLY'};
    if(!data.settings.active_config_version_id)return {status:'NOT_AVAILABLE',reason:'NO_ACTIVE_COST_CONFIG'};
    var config=configurationFromData(input.domain||root.CostingDomain,data);
    if(!config)return {status:'NOT_AVAILABLE',reason:'NO_ACTIVE_COST_CONFIG'};
    return {status:'READY',reason:'',configuration:config};
  }

  function activeConfiguration(input){
    var current=state(input);
    return current.status==='READY'?current.configuration:null;
  }

  function resolveConfigurationForRow(domain,configuration,row){
    if(!domain||!configuration)return null;
    if(domain.resolveModelConfiguration&&domain.normalizeInput){
      var normalized=domain.normalizeInput(row||{});
      return domain.resolveModelConfiguration({model:configuration,context:(normalized&&normalized.context)||{}});
    }
    return configuration;
  }

  function evaluateLegacyRow(input){
    input=input||{};
    var domain=input.domain||root.CostingDomain;
    var current=state(input);
    if(current.status!=='READY'){
      return {status:current.status,reason:current.reason,unavailable:true};
    }
    var resolved=resolveConfigurationForRow(domain,current.configuration,input.row||{});
    if(!resolved||!domain||typeof domain.evaluateModel001!=='function'){
      return {status:'NOT_AVAILABLE',reason:'NO_COSTING_ENGINE',unavailable:true};
    }
    var result=domain.evaluateModel001(input.row||{},resolved);
    if(result&&result.status==null)result.status='LOCAL_MODEL';
    return result;
  }

  async function ensureActiveConfiguration(input){
    input=input||{};
    if(!input.authUser||!input.settingsService||!input.client)return;
    var companyName=input.companyName||'';
    var key=cacheKey(input);
    if(!companyName||!key||activeConfigCache[key]||activeConfigLoading[key])return;
    activeConfigLoading[key]=true;
    try{
      var data=await input.settingsService.load(input.client,{companyName:companyName});
      activeConfigCache[key]=data||{};
      if(input.onChange)input.onChange(input.reason||'costing-config');
    }catch(err){
      activeConfigCache[key]={error:err&&err.message?err.message:String(err||'COSTING_CONFIG_ERROR')};
      if(input.onChange)input.onChange(input.reason||'costing-config-error');
    }finally{
      delete activeConfigLoading[key];
    }
  }

  function clear(){
    activeConfigCache={};
    activeConfigLoading={};
  }

  root.StdtexCostingRuntime={
    cacheKey:cacheKey,
    normalizeOverride:normalizeOverride,
    state:state,
    activeConfiguration:activeConfiguration,
    evaluateLegacyRow:evaluateLegacyRow,
    ensureActiveConfiguration:ensureActiveConfiguration,
    clear:clear
  };
})(typeof window!=='undefined'?window:globalThis);
