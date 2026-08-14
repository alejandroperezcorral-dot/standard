var CostingSettings=(function(){
  var mountOptions=null;
  var rootId='company-costing-settings-root';

  function client(){return window.sb;}
  function notify(message,type){if(window.toast)toast(message,type||'ok');}
  function val(id){var e=document.getElementById(id);return e?e.value:'';}

  function render(){
    var root=document.getElementById(rootId);
    if(root)root.innerHTML=CostingSettingsRenderer.render(CostingSettingsState.get());
  }

  async function reload(selectedVersionId){
    if(!mountOptions)return;
    CostingSettingsState.set({loading:true,error:null});
    render();
    try{
      var data=await CostingSettingsService.load(client(),{
        companyName:mountOptions.companyName,
        selectedVersionId:selectedVersionId
      });
      CostingSettingsState.set(Object.assign({},data,{loading:false,error:null,dirty:false,testResult:null}));
    }catch(e){
      CostingSettingsState.set({loading:false,error:e.message||String(e)});
    }
    render();
  }

  function mount(options){
    mountOptions=options||{};
    CostingSettingsState.reset();
    reload();
  }

  function selected(){
    return CostingSettingsState.selectedVersion();
  }

  async function selectVersion(id){
    var details=await CostingSettingsService.loadVersionDetails(client(),id);
    CostingSettingsState.set({selectedVersionId:id,overrides:details.overrides,components:details.components,dirty:false,testResult:null});
    render();
  }

  async function setFobOnly(){
    var s=CostingSettingsState.get();
    if(!s.company)return;
    try{
      await CostingSettingsService.setFobOnly(client(),s.company.id);
      notify('Cost source updated','ok');
      await reload(s.selectedVersionId);
    }catch(e){notify(e.message||String(e),'err');}
  }

  async function ensureModel001Draft(){
    var s=CostingSettingsState.get();
    if(!s.company)return;
    try{
      var draft=CostingSettingsState.latestDraft();
      if(!draft)draft=await CostingSettingsService.createModel001Draft(client(),{companyId:s.company.id});
      notify('Draft ready','ok');
      await reload(draft.id);
    }catch(e){notify(e.message||String(e),'err');}
  }

  function collectAssumptions(){
    var base=(selected()&&selected().base_config&&selected().base_config.assumptions)||{};
    var assumptions=Object.assign({},base);
    var inputs=document.querySelectorAll('[data-cost-var]');
    Array.prototype.forEach.call(inputs,function(input){
      var key=input.getAttribute('data-cost-var');
      var type=input.getAttribute('data-cost-type');
      var raw=input.value;
      assumptions[key]=type==='text'?String(raw||'').trim():Number(raw);
    });
    return assumptions;
  }

  async function saveDraft(){
    var version=selected();
    if(!version||version.lifecycle_status!=='DRAFT')return;
    try{
      await CostingSettingsService.saveDraftAssumptions(client(),version.id,collectAssumptions());
      notify('Draft saved','ok');
      await reload(version.id);
    }catch(e){notify(e.message||String(e),'err');}
  }

  async function duplicateSelected(){
    var version=selected();
    if(!version)return;
    try{
      var draft=await CostingSettingsService.duplicateDraft(client(),version);
      notify('Draft created','ok');
      await reload(draft.id);
    }catch(e){notify(e.message||String(e),'err');}
  }

  async function addOverride(){
    var version=selected();
    if(!version||version.lifecycle_status!=='DRAFT')return;
    var fixed=val('cost-override-fixed'),pct=val('cost-override-percent');
    var values={};
    if(fixed!=='')values.fixedDuty=Number(fixed);
    if(pct!=='')values.dutyPercent=Number(pct)/100;
    try{
      await CostingSettingsService.addOverride(client(),{
        configVersionId:version.id,
        seasonKey:val('cost-override-season'),
        originKey:val('cost-override-origin'),
        categoryKey:val('cost-override-category'),
        values:values,
        sourceReference:'Company Costing Settings'
      });
      notify('Override saved','ok');
      await reload(version.id);
    }catch(e){notify(e.message||String(e),'err');}
  }

  async function removeOverride(id){
    var version=selected();
    if(!version)return;
    try{
      await CostingSettingsService.removeOverride(client(),id);
      notify('Override removed','ok');
      await reload(version.id);
    }catch(e){notify(e.message||String(e),'err');}
  }

  async function addComponent(){
    var version=selected();
    if(!version||version.lifecycle_status!=='DRAFT')return;
    try{
      await CostingSettingsService.addComponent(client(),{
        configVersionId:version.id,
        component:{
          name:val('cost-component-name'),
          calculation_type:'FIXED_PER_UNIT',
          value:Number(val('cost-component-value')),
          currency:(val('cost-component-currency')||'USD').toUpperCase(),
          enabled:true,
          source_reference:'Company Costing Settings'
        }
      });
      notify('Cost added','ok');
      await reload(version.id);
    }catch(e){notify(e.message||String(e),'err');}
  }

  async function removeComponent(id){
    var version=selected();
    if(!version)return;
    try{
      await CostingSettingsService.removeComponent(client(),id);
      notify('Cost removed','ok');
      await reload(version.id);
    }catch(e){notify(e.message||String(e),'err');}
  }

  function activationErrorMessage(error){
    var message=error&&error.message?error.message:String(error||'');
    if(/SEMANTIC_VALIDATION_STALE|semantically validated|semantic/i.test(message)){
      return 'Configuration changed. Test it again before activation.';
    }
    return message;
  }

  async function testConfiguration(){
    var version=selected();
    if(!version)return;
    var input={
      fob:Number(val('cost-test-fob')),
      pvp_rub:Number(val('cost-test-rrp')),
      origin:val('cost-test-origin'),
      transport:val('cost-test-transport'),
      category:val('cost-test-category'),
      units:Number(val('cost-test-units')),
      weight:Number(val('cost-test-weight'))
    };
    try{
      if(version.lifecycle_status==='DRAFT'){
        var validation=await CostingSettingsService.validateDraft(client(),version.id);
        if(!validation.valid){
          notify('Configuration is not valid','err');
          CostingSettingsState.set({testResult:null});
          render();
          return;
        }
        notify('Configuration validated','ok');
        await reload(version.id);
        version=selected()||version;
      }
      CostingSettingsState.set({testResult:CostingSettingsService.testConfiguration(version,CostingSettingsState.get().overrides,input)});
      render();
    }catch(e){notify(e.message||String(e),'err');}
  }

  async function activateSelected(){
    var version=selected();
    if(!version||version.lifecycle_status!=='DRAFT')return;
    if(!confirm('Activate '+(version.config_label||version.config_code)+'? Future costing settings for this company will use this version.'))return;
    try{
      await CostingSettingsService.activate(client(),version.id);
      notify('Configuration activated','ok');
      if(root.resetCostResultState)root.resetCostResultState();
      if(root.ensureCostResultsForRows&&root.ROWS)root.ensureCostResultsForRows(root.ROWS,'costing-settings');
      await reload(version.id);
    }catch(e){notify(activationErrorMessage(e),'err');}
  }

  async function archiveSelected(){
    var version=selected();
    if(!version||version.lifecycle_status!=='DRAFT')return;
    try{
      await CostingSettingsService.archive(client(),version.id);
      notify('Configuration archived','ok');
      await reload(version.id);
    }catch(e){notify(e.message||String(e),'err');}
  }

  return {
    mount:mount,
    selectVersion:selectVersion,
    setFobOnly:setFobOnly,
    ensureModel001Draft:ensureModel001Draft,
    saveDraft:saveDraft,
    duplicateSelected:duplicateSelected,
    addOverride:addOverride,
    removeOverride:removeOverride,
    addComponent:addComponent,
    removeComponent:removeComponent,
    testConfiguration:testConfiguration,
    activateSelected:activateSelected,
    archiveSelected:archiveSelected
  };
})();
