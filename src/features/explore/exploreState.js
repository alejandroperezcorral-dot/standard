function createExploreReadState(input){
  input=input||{};
  return {
    search:exploreNormalizeSearch(input.search),
    supplier:input.supplier||'',
    season:input.season||'',
    department:input.department||'',
    status:input.status||'',
    category:input.category||'',
    origin:input.origin||'',
    source:input.source||'',
    collectionsView:!!input.collectionsView,
    activeCollection:input.activeCollection||'',
    savedOnly:!!input.savedOnly,
    savedIds:input.savedIds||[],
    loggedIn:!!input.loggedIn,
    hasAuthProfile:!!input.hasAuthProfile,
    adminBypass:!!input.adminBypass,
    adminViewActive:!!input.adminViewActive
  };
}
function createExploreStateStore(initial){
  var state=createExploreReadState(initial||{});
  function normalizeFilterName(name){
    var map={dept:'department',cat:'category',supp:'supplier',q:'search'};
    return map[name]||name;
  }
  function setValue(name,value){
    name=normalizeFilterName(name);
    if(name==='savedOnly'||name==='collectionsView')state[name]=!!value;
    else state[name]=name==='search'?exploreNormalizeSearch(value):value||'';
  }
  return {
    snapshot:function(extra){
      return createExploreReadState(Object.assign({},state,extra||{}));
    },
    getState:function(){return this.snapshot();},
    getSearch:function(){return state.search||'';},
    setSearch:function(value){setValue('search',value);},
    getFilters:function(){
      return {
        supplier:state.supplier||'',
        season:state.season||'',
        department:state.department||'',
        status:state.status||'',
        category:state.category||'',
        origin:state.origin||'',
        source:state.source||''
      };
    },
    setFilter:function(name,value){setValue(name,value);},
    resetFilters:function(){
      ['search','supplier','season','department','status','category','origin','source'].forEach(function(name){setValue(name,'');});
    },
    getSavedOnly:function(){return !!state.savedOnly;},
    setSavedOnly:function(value){setValue('savedOnly',value);},
    getCollectionsView:function(){return !!state.collectionsView;},
    setCollectionsView:function(value){setValue('collectionsView',value);},
    reset:function(){
      state=createExploreReadState({});
    }
  };
}
