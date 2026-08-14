var CostingSettingsState=(function(){
  var state={
    company:null,
    models:[],
    settings:null,
    versions:[],
    selectedVersionId:null,
    overrides:[],
    components:[],
    dirty:false,
    loading:false,
    error:null,
    testResult:null,
    expandedSections:{}
  };

  function get(){
    return state;
  }

  function set(patch){
    Object.assign(state,patch||{});
    return state;
  }

  function selectedVersion(){
    return (state.versions||[]).filter(function(v){return v.id===state.selectedVersionId;})[0]||null;
  }

  function activeVersion(){
    return (state.versions||[]).filter(function(v){return v.lifecycle_status==='ACTIVE';})[0]||null;
  }

  function latestDraft(){
    return (state.versions||[]).filter(function(v){return v.lifecycle_status==='DRAFT';})[0]||null;
  }

  function reset(){
    state={
      company:null,
      models:[],
      settings:null,
      versions:[],
      selectedVersionId:null,
      overrides:[],
      components:[],
      dirty:false,
      loading:false,
      error:null,
      testResult:null,
      expandedSections:{}
    };
    return state;
  }

  return {
    get:get,
    set:set,
    reset:reset,
    selectedVersion:selectedVersion,
    activeVersion:activeVersion,
    latestDraft:latestDraft
    ,
    isExpanded:function(key){return !!(state.expandedSections&&state.expandedSections[key]);},
    toggleExpanded:function(key){
      state.expandedSections=Object.assign({},state.expandedSections||{});
      state.expandedSections[key]=!state.expandedSections[key];
      return state.expandedSections[key];
    }
  };
})();
