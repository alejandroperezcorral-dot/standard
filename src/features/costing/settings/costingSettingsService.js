var CostingSettingsService=(function(){
  var MODEL_001_CODE='cost-model-001';

  function repo(){return CostingSettingsRepository;}

  function assertOk(result){
    if(result&&result.error)throw result.error;
    return result?result.data:null;
  }

  function defaultConfig(){
    return CostingDomain.createModel001Configuration({
      configurationVersion:'CURRENT',
      dutyOverrides:CostingDomain.createModel001Fw26DutyOverrides()
    });
  }

  function versionPatchFromBaseConfig(baseConfig){
    baseConfig=baseConfig||{};
    var editableKeys=[
      'configurationVersion',
      'name',
      'status',
      'source',
      'assumptions',
      'freightRoutes',
      'dutyRows',
      'dutyOverrides',
      'fixedCosts',
      'percentageCosts',
      'transit',
      'variables',
      'scopes',
      'resolutionTrace',
      'context'
    ];
    return editableKeys.reduce(function(patch,key){
      if(Object.prototype.hasOwnProperty.call(baseConfig,key))patch[key]=baseConfig[key];
      return patch;
    },{});
  }

  async function load(client,input){
    input=input||{};
    var company=assertOk(await repo().selectCompanyByName(client,input.companyName));
    if(!company)throw new Error('Company not found');
    var models=assertOk(await repo().selectModels(client))||[];
    var settings=assertOk(await repo().selectSettings(client,company.id));
    var versions=assertOk(await repo().selectVersions(client,company.id))||[];
    var selectedId=input.selectedVersionId||null;
    if(!selectedId&&settings&&settings.active_config_version_id)selectedId=settings.active_config_version_id;
    if(!selectedId&&versions.length)selectedId=versions[0].id;
    var details=await loadVersionDetails(client,selectedId);
    return {
      company:company,
      models:models,
      settings:settings,
      versions:versions,
      selectedVersionId:selectedId,
      overrides:details.overrides,
      components:details.components
    };
  }

  async function loadVersionDetails(client,versionId){
    if(!versionId)return{overrides:[],components:[]};
    var overrides=assertOk(await repo().selectOverrides(client,versionId))||[];
    var components=assertOk(await repo().selectComponents(client,versionId))||[];
    return {overrides:overrides,components:components};
  }

  async function setFobOnly(client,companyId){
    return assertOk(await repo().setCompanyCostSource(client,{
      companyId:companyId,
      costSourceType:'FOB_ONLY',
      fallbackBehavior:'FOB_ONLY'
    }));
  }

  async function createModel001Draft(client,input){
    input=input||{};
    var stamp=new Date().toISOString().replace(/[-:.TZ]/g,'').slice(0,12);
    return assertOk(await repo().createDraft(client,{
      companyId:input.companyId,
      costModelCode:MODEL_001_CODE,
      configCode:input.configCode||('model-001-draft-'+stamp),
      configLabel:input.configLabel||('Cost Model 001 Draft '+stamp),
      baseConfig:input.baseConfig||defaultConfig(),
      basedOnConfigVersionId:input.basedOnConfigVersionId||null,
      seasonKey:input.seasonKey||null,
      sourceReference:'STDTEX Costing Settings',
      notes:input.notes||null
    }));
  }

  async function duplicateDraft(client,configVersion){
    var stamp=new Date().toISOString().replace(/[-:.TZ]/g,'').slice(0,12);
    return assertOk(await repo().duplicateConfig(client,{
      configVersionId:configVersion.id,
      newConfigCode:(configVersion.config_code||'cost-model-001')+'-draft-'+stamp,
      newConfigLabel:(configVersion.config_label||'Cost Model 001')+' Draft'
    }));
  }

  async function saveDraftBaseConfig(client,configVersionId,baseConfig){
    return assertOk(await repo().updateDraft(client,{
      configVersionId:configVersionId,
      patch:versionPatchFromBaseConfig(baseConfig)
    }));
  }

  async function addOverride(client,input){
    return assertOk(await repo().upsertOverride(client,input));
  }

  async function removeOverride(client,overrideId){
    return assertOk(await repo().removeOverride(client,overrideId));
  }

  async function addComponent(client,input){
    return assertOk(await repo().addComponent(client,input));
  }

  async function removeComponent(client,componentId){
    return assertOk(await repo().removeComponent(client,componentId));
  }

  async function activate(client,configVersionId){
    return assertOk(await repo().activateConfig(client,configVersionId));
  }

  async function validateDraft(client,configVersionId){
    var result=assertOk(await repo().validateCostConfig(client,configVersionId));
    if(!result||result.ok!==true)throw new Error('Configuration validation failed');
    return result;
  }

  async function archive(client,configVersionId){
    return assertOk(await repo().archiveConfig(client,configVersionId));
  }

  function buildResolvedConfiguration(version,overrides){
    var base=(version&&version.base_config)||defaultConfig();
    var normalizedOverrides=(overrides||[]).map(function(row){
      return {
        id:row.id,
        scope:{origin:row.origin_key,category:row.category_key},
        period:{season:row.season_key},
        values:row.values||{},
        source:row.source_reference||'Company override'
      };
    });
    var model=Object.assign({},base,{dutyOverrides:normalizedOverrides});
    return CostingDomain.resolveModelConfiguration({model:model,context:{}});
  }

  function testConfiguration(version,overrides,input){
    var resolved=buildResolvedConfiguration(version,overrides);
    return CostingDomain.evaluateModel001(input||{},resolved);
  }

  return {
    MODEL_001_CODE:MODEL_001_CODE,
    load:load,
    loadVersionDetails:loadVersionDetails,
    setFobOnly:setFobOnly,
    createModel001Draft:createModel001Draft,
    duplicateDraft:duplicateDraft,
    saveDraftBaseConfig:saveDraftBaseConfig,
    addOverride:addOverride,
    removeOverride:removeOverride,
    addComponent:addComponent,
    removeComponent:removeComponent,
    validateDraft:validateDraft,
    activate:activate,
    archive:archive,
    defaultConfig:defaultConfig,
    testConfiguration:testConfiguration,
    _versionPatchFromBaseConfig:versionPatchFromBaseConfig
  };
})();
