var CostingSettingsRenderer=(function(){
  function esc(value){
    return window.escHtml?window.escHtml(value):String(value==null?'':value).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];});
  }

  function fmtNumber(value,digits){
    var n=Number(value);
    if(!isFinite(n))n=0;
    return n.toLocaleString(undefined,{maximumFractionDigits:digits==null?2:digits});
  }

  function fmtPercent(value){
    var n=Number(value);
    if(!isFinite(n))n=0;
    return (n*100).toFixed(1)+'%';
  }

  function statusBadge(value){
    var v=String(value||'').toUpperCase();
    var cls=v==='ACTIVE'?' active':v==='DRAFT'?' draft':'';
    return '<span class="costing-status'+cls+'">'+esc(v||'NONE')+'</span>';
  }

  function sourceHtml(state){
    var source=(state.settings&&state.settings.cost_source_type)||'FOB_ONLY';
    var active=CostingSettingsState.activeVersion();
    return '<div class="costing-panel costing-source-panel" data-testid="costing-source-panel"><div><h3>Cost source</h3><p>Company Admin controls the costing model. Buyer calculations remain unchanged in this phase.</p></div><div class="costing-source-actions"><button class="'+(source==='FOB_ONLY'?'on':'')+'" onclick="CostingSettings.setFobOnly()">FOB only</button><button class="'+(source==='STDTEX_MODEL'?'on':'')+'" onclick="CostingSettings.ensureModel001Draft()">Cost Model 001</button></div><div class="costing-current" data-testid="costing-active-config"><div><span>Model</span><b>'+(source==='STDTEX_MODEL'?'Cost Model 001':'FOB only')+'</b></div><div><span>Formula</span><b>Version 1</b></div><div><span>Configuration</span><b>'+esc(active?(active.config_label||active.config_code):'No active configuration')+'</b></div><div><span>Status</span><b>'+esc(active?active.lifecycle_status:source)+'</b></div></div></div>';
  }

  function versionListHtml(state){
    var versions=state.versions||[];
    var h='<div class="costing-panel"><div class="costing-panel-head"><div><h3>Versions</h3><p>Active and archived versions are read-only. Edit by creating a Draft.</p></div><button data-testid="costing-new-draft" onclick="CostingSettings.createModel001Draft()">New Draft</button></div><div class="costing-version-list">';
    if(!versions.length)h+='<div class="company-empty">No Cost Model 001 configuration yet.</div>';
    versions.forEach(function(v){
      h+='<button class="costing-version-row '+(state.selectedVersionId===v.id?'on':'')+'" data-testid="costing-version-row" onclick="CostingSettings.selectVersion(\''+esc(v.id)+'\')"><span><b>'+esc(v.config_label||v.config_code)+'</b><small>'+esc(v.config_code)+' - Formula '+esc(v.formula_version)+' - '+esc(v.semantic_validation_status)+'</small></span>'+statusBadge(v.lifecycle_status)+'</button>';
    });
    h+='</div></div>';
    return h;
  }

  function assumptionsHtml(version){
    if(!version)return '';
    var readOnly=version.lifecycle_status!=='DRAFT';
    var base=version.base_config||{};
    var assumptions=Object.assign({},(base.assumptions||{}));
    var variables=CostingDomain.getModel001VariableMetadata();
    var grouped={};
    variables.forEach(function(v){(grouped[v.category]||(grouped[v.category]=[])).push(v);});
    var h='<div class="costing-panel" data-testid="costing-assumptions"><div class="costing-panel-head"><div><h3>Variables</h3><p>Current values are loaded from the selected persisted configuration.</p></div>'+(readOnly?'<span class="platform-badge">Read only</span>':'<button data-testid="costing-save-draft" onclick="CostingSettings.saveDraft()">Save Draft</button>')+'</div>';
    Object.keys(grouped).forEach(function(group){
      h+='<h4 class="costing-section-title">'+esc(group)+'</h4><div class="costing-variable-grid">';
      grouped[group].forEach(function(v){
        var value=Object.prototype.hasOwnProperty.call(assumptions,v.key)?assumptions[v.key]:v.defaultValue;
        h+='<label class="costing-field"><span>'+esc(v.label)+'</span><small>'+esc(v.description)+'</small><input data-cost-var="'+esc(v.key)+'" data-cost-type="'+esc(v.type)+'" '+(readOnly?'disabled':'')+' value="'+esc(value)+'"></label>';
      });
      h+='</div>';
    });
    if(!readOnly)h+='<div class="costing-note">Unsaved variable changes reset semantic validation to NOT_VALIDATED until the trusted backend validator approves them.</div>';
    h+='</div>';
    return h;
  }

  function routeRows(base){
    var routes=(base&&base.freightRoutes)||{};
    return Object.keys(routes).sort().map(function(key){
      var parts=key.split('|');
      return {
        key:key,
        origin:parts[0]||'',
        transport:parts.slice(1).join('|')||'',
        cost:routes[key]&&routes[key].cost!=null?routes[key].cost:0,
        days:routes[key]&&routes[key].days!=null?routes[key].days:0
      };
    });
  }

  function logisticsHtml(version,state){
    if(!version)return '';
    var readOnly=version.lifecycle_status!=='DRAFT';
    var open=CostingSettingsState.isExpanded('logistics');
    var rows=routeRows(version.base_config||{});
    var h='<div class="costing-panel" data-testid="costing-logistics"><div class="costing-panel-head"><div><h3>Logistics & Transport</h3><p>'+rows.length+' country and transport rules from Model 001.</p></div><button data-testid="costing-toggle-logistics" onclick="CostingSettings.toggleSection(&quot;logistics&quot;)">'+(open?'Close':'Open')+'</button></div>';
    if(open){
      h+='<div class="costing-table-wrap"><table class="platform-table"><thead><tr><th>Country / Origin</th><th>Transport</th><th>Freight cost</th><th>Days</th><th></th></tr></thead><tbody>';
      rows.forEach(function(row,index){
        h+='<tr data-cost-route-row="'+index+'"><td><input data-cost-route-field="origin" '+(readOnly?'disabled':'')+' value="'+esc(row.origin)+'"></td><td><input data-cost-route-field="transport" '+(readOnly?'disabled':'')+' value="'+esc(row.transport)+'"></td><td><input data-cost-route-field="cost" type="number" step="0.01" '+(readOnly?'disabled':'')+' value="'+esc(row.cost)+'"></td><td><input data-cost-route-field="days" type="number" step="1" '+(readOnly?'disabled':'')+' value="'+esc(row.days)+'"></td><td>'+(readOnly?'':'<button class="subtle danger" onclick="CostingSettings.removeLogisticsRow('+index+')">Remove</button>')+'</td></tr>';
      });
      if(!rows.length)h+='<tr><td colspan="5">No logistics rules yet.</td></tr>';
      h+='</tbody></table></div>';
      if(!readOnly)h+='<div class="costing-inline-form compact"><input id="cost-logistics-origin" placeholder="VIETNAM"><input id="cost-logistics-transport" placeholder="SEA-TRUCK"><input id="cost-logistics-cost" placeholder="9762"><input id="cost-logistics-days" placeholder="44"><button data-testid="costing-add-logistics" onclick="CostingSettings.addLogisticsRow()">Add</button></div>';
    }
    h+='</div>';
    return h;
  }

  function dutiesHtml(version,state){
    if(!version)return '';
    var readOnly=version.lifecycle_status!=='DRAFT';
    var open=CostingSettingsState.isExpanded('duties');
    var rows=((version.base_config||{}).dutyRows||[]);
    var h='<div class="costing-panel" data-testid="costing-duties"><div class="costing-panel-head"><div><h3>Duties & Tariffs</h3><p>'+rows.length+' Country / Department / Category rules from Model 001.</p></div><button data-testid="costing-toggle-duties" onclick="CostingSettings.toggleSection(&quot;duties&quot;)">'+(open?'Close':'Open')+'</button></div>';
    if(open){
      h+='<div class="costing-table-wrap"><table class="platform-table"><thead><tr><th>Country</th><th>Department</th><th>Category</th><th>Fixed Duty</th><th>Duty %</th><th>Load Norm KG</th><th></th></tr></thead><tbody>';
      rows.forEach(function(row,index){
        h+='<tr data-cost-duty-row="'+index+'"><td><input data-cost-duty-field="country" '+(readOnly?'disabled':'')+' value="'+esc(row.country)+'"></td><td><input data-cost-duty-field="dept" '+(readOnly?'disabled':'')+' value="'+esc(row.dept||'')+'"></td><td><input data-cost-duty-field="cat" '+(readOnly?'disabled':'')+' value="'+esc(row.cat)+'"></td><td><input data-cost-duty-field="fixed" type="number" step="0.01" '+(readOnly?'disabled':'')+' value="'+esc(row.fixed)+'"></td><td><input data-cost-duty-field="pct" type="number" step="0.001" '+(readOnly?'disabled':'')+' value="'+esc(row.pct)+'"></td><td><input data-cost-duty-field="load_norm" type="number" step="1" '+(readOnly?'disabled':'')+' value="'+esc(row.load_norm)+'"></td><td>'+(readOnly?'':'<button class="subtle danger" onclick="CostingSettings.removeDutyRow('+index+')">Remove</button>')+'</td></tr>';
      });
      if(!rows.length)h+='<tr><td colspan="7">No duty rules yet.</td></tr>';
      h+='</tbody></table></div>';
      if(!readOnly)h+='<div class="costing-inline-form"><input id="cost-duty-country" placeholder="VIETNAM"><input id="cost-duty-dept" placeholder="Jackets"><input id="cost-duty-cat" placeholder="Jct Nondenim"><input id="cost-duty-fixed" placeholder="2.25"><input id="cost-duty-pct" placeholder="0.10"><input id="cost-duty-load" placeholder="8000"><button data-testid="costing-add-duty" onclick="CostingSettings.addDutyRow()">Add</button></div>';
    }
    h+='</div>';
    return h;
  }

  function overridesHtml(version,overrides){
    if(!version)return '';
    var readOnly=version.lifecycle_status!=='DRAFT';
    var h='<div class="costing-panel"><div class="costing-panel-head"><div><h3>Overrides</h3><p>Scope is Season + Origin + Category. Empty variables inherit from Base Configuration.</p></div></div>';
    h+='<div class="costing-table-wrap"><table class="platform-table"><thead><tr><th>Season</th><th>Origin</th><th>Category</th><th>Fixed Duty</th><th>Duty %</th><th>Source</th><th></th></tr></thead><tbody>';
    (overrides||[]).forEach(function(o){
      var values=o.values||{};
      h+='<tr><td>'+esc(o.season_key)+'</td><td>'+esc(o.origin_key)+'</td><td>'+esc(o.category_key)+'</td><td>'+esc(values.fixedDuty==null?'Inherited':values.fixedDuty)+'</td><td>'+esc(values.dutyPercent==null?'Inherited':fmtPercent(values.dutyPercent))+'</td><td>'+esc(o.source_reference||'')+'</td><td>'+(readOnly?'':'<button class="subtle danger" onclick="CostingSettings.removeOverride(\''+esc(o.id)+'\')">Remove</button>')+'</td></tr>';
    });
    if(!(overrides||[]).length)h+='<tr><td colspan="7">No overrides yet.</td></tr>';
    h+='</tbody></table></div>';
    if(!readOnly){
      h+='<div class="costing-inline-form"><input id="cost-override-season" placeholder="FW26"><input id="cost-override-origin" placeholder="VIETNAM"><input id="cost-override-category" placeholder="Pants Commercial"><input id="cost-override-fixed" placeholder="Fixed duty"><input id="cost-override-percent" placeholder="Duty %"><button data-testid="costing-add-override" onclick="CostingSettings.addOverride()">Add Override</button></div>';
    }
    h+='</div>';
    return h;
  }

  function componentsHtml(version,components){
    if(!version)return '';
    var readOnly=version.lifecycle_status!=='DRAFT';
    var h='<div class="costing-panel"><div class="costing-panel-head"><div><h3>Additional Costs</h3><p>V1 exposes safe structured costs only. No formulas, JavaScript or SQL.</p></div></div><div class="costing-table-wrap"><table class="platform-table"><thead><tr><th>Name</th><th>Type</th><th>Value</th><th>Currency</th><th>Enabled</th><th></th></tr></thead><tbody>';
    (components||[]).forEach(function(c){
      h+='<tr><td>'+esc(c.name)+'</td><td>'+esc(c.calculation_type)+'</td><td>'+esc(c.value)+'</td><td>'+esc(c.currency||'')+'</td><td>'+esc(c.enabled?'Yes':'No')+'</td><td>'+(readOnly?'':'<button class="subtle danger" onclick="CostingSettings.removeComponent(\''+esc(c.id)+'\')">Remove</button>')+'</td></tr>';
    });
    if(!(components||[]).length)h+='<tr><td colspan="6">No additional costs yet.</td></tr>';
    h+='</tbody></table></div>';
    if(!readOnly)h+='<div class="costing-inline-form compact"><input id="cost-component-name" placeholder="Inspection"><input id="cost-component-value" placeholder="0.10"><input id="cost-component-currency" placeholder="USD"><button onclick="CostingSettings.addComponent()">Add Cost</button></div>';
    h+='</div>';
    return h;
  }

  function testHtml(version,state){
    if(!version)return '';
    var result=state.testResult;
    var h='<div class="costing-panel"><div class="costing-panel-head"><div><h3>Test Configuration</h3><p>Preview with the same Cost Model 001 evaluator. Testing does not activate the draft.</p></div><button data-testid="costing-test-config" onclick="CostingSettings.testConfiguration()">Test</button></div>';
    h+='<div class="costing-variable-grid"><label class="costing-field"><span>FOB</span><input id="cost-test-fob" value="8"></label><label class="costing-field"><span>RRP RUB</span><input id="cost-test-rrp" value="1999"></label><label class="costing-field"><span>Origin</span><input id="cost-test-origin" value="VIETNAM"></label><label class="costing-field"><span>Transport</span><input id="cost-test-transport" value="SEA-TRUCK"></label><label class="costing-field"><span>Category</span><input id="cost-test-category" value="Pants Commercial"></label><label class="costing-field"><span>Units</span><input id="cost-test-units" value="1200"></label><label class="costing-field"><span>Weight KG</span><input id="cost-test-weight" value="0.23"></label></div>';
    if(result){
      h+='<div class="costing-current test" data-testid="costing-test-result"><div><span>Estimated Landed</span><b>$'+fmtNumber(result.landedCost,2)+'</b></div><div><span>IMU</span><b>'+fmtPercent(result.imu)+'</b></div><div><span>Markup</span><b>'+fmtNumber(result.markup,2)+'</b></div><div><span>Target FOB</span><b>$'+fmtNumber(result.targetFob,2)+'</b></div></div>';
    }
    h+='</div>';
    return h;
  }

  function actionsHtml(version){
    if(!version)return '';
    var h='<div class="costing-panel"><div class="costing-panel-head"><div><h3>Lifecycle</h3><p>Activation is server-gated. Invalid drafts cannot activate from direct RPC or browser UI.</p></div></div><div class="costing-actions">';
    if(version.lifecycle_status==='ACTIVE')h+='<button data-testid="costing-create-draft" onclick="CostingSettings.createModel001Draft()">Create new Draft</button>';
    if(version.lifecycle_status==='ARCHIVED')h+='<button data-testid="costing-duplicate-draft" onclick="CostingSettings.duplicateSelected()">Duplicate as Draft</button>';
    if(version.lifecycle_status==='DRAFT'){
      h+='<button data-testid="costing-activate-config" onclick="CostingSettings.activateSelected()">Activate</button><button class="subtle" data-testid="costing-archive-draft" onclick="CostingSettings.archiveSelected()">Archive Draft</button>';
      if(version.semantic_validation_status!=='VALID')h+='<span class="costing-note inline">Requires trusted backend semantic validation before activation.</span>';
    }
    h+='</div></div>';
    return h;
  }

  function render(state){
    if(state.loading)return '<div class="company-panel"><h3>Costing</h3><p>Loading company costing settings...</p></div>';
    if(state.error)return '<div class="company-empty">Costing settings error: '+esc(state.error)+'</div>';
    var version=CostingSettingsState.selectedVersion();
    var h='<div class="costing-settings"><div class="platform-page-head"><div><h2>Costing</h2><p>Company Admin manages costing complexity here. Buyer surfaces stay simple.</p></div></div>';
    h+=sourceHtml(state);
    h+='<div class="costing-layout"><div>'+versionListHtml(state)+actionsHtml(version)+'</div><div>'+assumptionsHtml(version)+logisticsHtml(version,state)+dutiesHtml(version,state)+overridesHtml(version,state.overrides)+componentsHtml(version,state.components)+testHtml(version,state)+'</div></div>';
    h+='</div>';
    return h;
  }

  return {render:render};
})();
