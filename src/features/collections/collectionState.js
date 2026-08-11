function createCollectionState(initial){
  var state={
    scope:(initial&&initial.scope)==='groups'?'groups':'mine',
    groupFilters:Array.isArray(initial&&initial.groupFilters)?initial.groupFilters.slice():[]
  };
  function unique(values){
    return (values||[]).filter(function(v,i,a){return v&&a.indexOf(v)===i;});
  }
  function normalize(v,fn){
    return fn?fn(v):String(v||'').trim().toLowerCase();
  }
  return {
    getScope:function(){return state.scope;},
    setScope:function(scope){
      state.scope=scope==='groups'?'groups':'mine';
      return state.scope;
    },
    getGroupFilters:function(){return state.groupFilters.slice();},
    setGroupFilters:function(filters){
      state.groupFilters=unique(Array.isArray(filters)?filters.slice():[]);
      return state.groupFilters.slice();
    },
    resetGroupFilters:function(){
      state.groupFilters=[];
      return state.groupFilters.slice();
    },
    toggleGroupFilter:function(group,on,normalizeName){
      group=(group||'').trim();
      if(!group)return state.groupFilters.slice();
      state.groupFilters=state.groupFilters.filter(function(g){return normalize(g,normalizeName)!==normalize(group,normalizeName);});
      if(on)state.groupFilters.push(group);
      return state.groupFilters.slice();
    },
    reset:function(next){
      state.scope=(next&&next.scope)==='groups'?'groups':'mine';
      state.groupFilters=unique(Array.isArray(next&&next.groupFilters)?next.groupFilters.slice():[]);
      return this.snapshot();
    },
    snapshot:function(){
      return {scope:state.scope,groupFilters:state.groupFilters.slice()};
    }
  };
}

var CollectionState=createCollectionState({scope:'mine',groupFilters:[]});
