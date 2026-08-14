var CostingSettingsRepository=(function(){
  function requireClient(client){
    if(!client)throw new Error('Supabase client is not available');
    return client;
  }

  function selectCompanyByName(client,companyName){
    return requireClient(client).from('companies').select('*').eq('name',companyName).maybeSingle();
  }

  function selectModels(client){
    return requireClient(client).from('cost_models').select('*').eq('status','AVAILABLE').order('code',{ascending:true});
  }

  function selectSettings(client,companyId){
    return requireClient(client).from('company_costing_settings').select('*').eq('company_id',companyId).maybeSingle();
  }

  function selectVersions(client,companyId){
    return requireClient(client).from('cost_config_versions').select('*').eq('company_id',companyId).order('created_at',{ascending:false});
  }

  function selectOverrides(client,configVersionId){
    return requireClient(client).from('cost_config_overrides').select('*').eq('config_version_id',configVersionId).order('season_key',{ascending:true}).order('origin_key',{ascending:true}).order('category_key',{ascending:true});
  }

  function selectComponents(client,configVersionId){
    return requireClient(client).from('cost_additional_components').select('*').eq('config_version_id',configVersionId).order('created_at',{ascending:false});
  }

  function setCompanyCostSource(client,input){
    input=input||{};
    return requireClient(client).rpc('set_company_cost_source',{
      p_company_id:input.companyId,
      p_cost_source_type:input.costSourceType,
      p_cost_model_code:input.costModelCode||null,
      p_active_config_version_id:input.activeConfigVersionId||null,
      p_fallback_behavior:input.fallbackBehavior||'FOB_ONLY'
    });
  }

  function createDraft(client,input){
    input=input||{};
    return requireClient(client).rpc('create_cost_config_draft',{
      p_company_id:input.companyId,
      p_cost_model_code:input.costModelCode,
      p_config_code:input.configCode,
      p_config_label:input.configLabel,
      p_base_config:input.baseConfig||null,
      p_based_on_config_version_id:input.basedOnConfigVersionId||null,
      p_season_key:input.seasonKey||null,
      p_source_reference:input.sourceReference||null,
      p_notes:input.notes||null
    });
  }

  function duplicateConfig(client,input){
    input=input||{};
    return requireClient(client).rpc('duplicate_cost_config',{
      p_config_version_id:input.configVersionId,
      p_new_config_code:input.newConfigCode,
      p_new_config_label:input.newConfigLabel
    });
  }

  function updateDraft(client,input){
    input=input||{};
    return requireClient(client).rpc('update_cost_config_draft',{
      p_config_version_id:input.configVersionId,
      p_patch:input.patch||{}
    });
  }

  function upsertOverride(client,input){
    input=input||{};
    return requireClient(client).rpc('upsert_cost_override',{
      p_config_version_id:input.configVersionId,
      p_season_key:input.seasonKey,
      p_origin_key:input.originKey,
      p_category_key:input.categoryKey,
      p_values:input.values||{},
      p_source_reference:input.sourceReference||null
    });
  }

  function removeOverride(client,overrideId){
    return requireClient(client).rpc('remove_cost_override',{p_override_id:overrideId});
  }

  function addComponent(client,input){
    input=input||{};
    return requireClient(client).rpc('add_cost_component',{
      p_config_version_id:input.configVersionId,
      p_component:input.component||{}
    });
  }

  function updateComponent(client,input){
    input=input||{};
    return requireClient(client).rpc('update_cost_component',{
      p_component_id:input.componentId,
      p_patch:input.patch||{}
    });
  }

  function removeComponent(client,componentId){
    return requireClient(client).rpc('remove_cost_component',{p_component_id:componentId});
  }

  function activateConfig(client,configVersionId){
    return requireClient(client).rpc('activate_cost_config',{p_config_version_id:configVersionId});
  }

  function validateCostConfig(client,configVersionId){
    return requireClient(client).functions.invoke('validate-cost-config',{
      body:{configId:configVersionId}
    });
  }

  function archiveConfig(client,configVersionId){
    return requireClient(client).rpc('archive_cost_config',{p_config_version_id:configVersionId});
  }

  return {
    selectCompanyByName:selectCompanyByName,
    selectModels:selectModels,
    selectSettings:selectSettings,
    selectVersions:selectVersions,
    selectOverrides:selectOverrides,
    selectComponents:selectComponents,
    setCompanyCostSource:setCompanyCostSource,
    createDraft:createDraft,
    duplicateConfig:duplicateConfig,
    updateDraft:updateDraft,
    upsertOverride:upsertOverride,
    removeOverride:removeOverride,
    addComponent:addComponent,
    updateComponent:updateComponent,
    removeComponent:removeComponent,
    activateConfig:activateConfig,
    validateCostConfig:validateCostConfig,
    archiveConfig:archiveConfig
  };
})();
