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

  async function createModel001Draft(){
    var s=CostingSettingsState.get();
    if(!s.company)return;
    try{
      var draft=await CostingSettingsService.createModel001Draft(client(),{companyId:s.company.id});
      notify('Draft created','ok');
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

  function normalizeKeyPart(value){
    return String(value||'').trim().toUpperCase();
  }

  function currentBaseConfig(){
    var version=selected();
    return CostingDomain.createModel001Configuration((version&&version.base_config)||{});
  }

  function collectFreightRoutes(){
    var routes={};
    var seen={};
    var rows=document.querySelectorAll('[data-cost-route-row]');
    Array.prototype.forEach.call(rows,function(row){
      var get=function(field){
        var input=row.querySelector('[data-cost-route-field="'+field+'"]');
        return input?input.value:'';
      };
      var origin=normalizeKeyPart(get('origin'));
      var transport=normalizeKeyPart(get('transport'));
      if(!origin&&!transport)return;
      var key=origin+'|'+transport;
      if(seen[key])throw new Error('Duplicate logistics row: '+key);
      seen[key]=true;
      routes[key]={cost:Number(get('cost')),days:Number(get('days'))};
    });
    return routes;
  }

  function collectDutyRows(){
    var duties=[];
    var seen={};
    var rows=document.querySelectorAll('[data-cost-duty-row]');
    Array.prototype.forEach.call(rows,function(row){
      var get=function(field){
        var input=row.querySelector('[data-cost-duty-field="'+field+'"]');
        return input?input.value:'';
      };
      var country=String(get('country')||'').trim();
      var dept=String(get('dept')||'').trim();
      var cat=String(get('cat')||'').trim();
      if(!country&&!dept&&!cat)return;
      var key=normalizeKeyPart(country)+'|'+normalizeKeyPart(dept)+'|'+normalizeKeyPart(cat);
      if(seen[key])throw new Error('Duplicate duty row: '+key);
      seen[key]=true;
      duties.push({
        country:country,
        dept:dept,
        cat:cat,
        fixed:Number(get('fixed')),
        pct:Number(get('pct')),
        load_norm:Number(get('load_norm'))
      });
    });
    return duties;
  }

  function collectBaseConfig(){
    var base=currentBaseConfig();
    base.assumptions=collectAssumptions();
    if(CostingSettingsState.isExpanded('logistics'))base.freightRoutes=collectFreightRoutes();
    if(CostingSettingsState.isExpanded('duties'))base.dutyRows=collectDutyRows();
    return base;
  }

  async function saveDraft(){
    var version=selected();
    if(!version||version.lifecycle_status!=='DRAFT')return;
    try{
      await CostingSettingsService.saveDraftBaseConfig(client(),version.id,collectBaseConfig());
      notify('Draft saved','ok');
      await reload(version.id);
    }catch(e){notify(e.message||String(e),'err');}
  }

  function mutateSelectedBase(mutator){
    var version=selected();
    if(!version||version.lifecycle_status!=='DRAFT')return;
    try{
      version.base_config=collectBaseConfig();
      mutator(version.base_config);
      CostingSettingsState.set({dirty:true,testResult:null});
      render();
    }catch(e){notify(e.message||String(e),'err');}
  }

  function addLogisticsRow(){
    mutateSelectedBase(function(base){
      var origin=normalizeKeyPart(val('cost-logistics-origin'));
      var transport=normalizeKeyPart(val('cost-logistics-transport'));
      if(!origin||!transport)throw new Error('Country and transport are required');
      var key=origin+'|'+transport;
      base.freightRoutes=base.freightRoutes||{};
      if(base.freightRoutes[key])throw new Error('Duplicate logistics row: '+key);
      base.freightRoutes[key]={cost:Number(val('cost-logistics-cost')),days:Number(val('cost-logistics-days'))};
    });
  }

  function removeLogisticsRow(index){
    mutateSelectedBase(function(base){
      var keys=Object.keys(base.freightRoutes||{}).sort();
      if(keys[index])delete base.freightRoutes[keys[index]];
    });
  }

  function addDutyRow(){
    mutateSelectedBase(function(base){
      var row={
        country:String(val('cost-duty-country')||'').trim(),
        dept:String(val('cost-duty-dept')||'').trim(),
        cat:String(val('cost-duty-cat')||'').trim(),
        fixed:Number(val('cost-duty-fixed')),
        pct:Number(val('cost-duty-pct')),
        load_norm:Number(val('cost-duty-load'))
      };
      if(!row.country||!row.dept||!row.cat)throw new Error('Country, department and category are required');
      var key=normalizeKeyPart(row.country)+'|'+normalizeKeyPart(row.dept)+'|'+normalizeKeyPart(row.cat);
      var rows=base.dutyRows||[];
      for(var i=0;i<rows.length;i++){
        var existing=normalizeKeyPart(rows[i].country)+'|'+normalizeKeyPart(rows[i].dept)+'|'+normalizeKeyPart(rows[i].cat);
        if(existing===key)throw new Error('Duplicate duty row: '+key);
      }
      rows.push(row);
      base.dutyRows=rows;
    });
  }

  function removeDutyRow(index){
    mutateSelectedBase(function(base){
      base.dutyRows=(base.dutyRows||[]).filter(function(_,i){return i!==index;});
    });
  }

  function toggleSection(key){
    CostingSettingsState.toggleExpanded(key);
    render();
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
    createModel001Draft:createModel001Draft,
    saveDraft:saveDraft,
    toggleSection:toggleSection,
    addLogisticsRow:addLogisticsRow,
    removeLogisticsRow:removeLogisticsRow,
    addDutyRow:addDutyRow,
    removeDutyRow:removeDutyRow,
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
