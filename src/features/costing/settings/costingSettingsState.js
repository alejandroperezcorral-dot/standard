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
    testResult:null
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
      testResult:null
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
  };
})();
