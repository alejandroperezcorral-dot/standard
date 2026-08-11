function createCollectionState(initial){
  var state={
    scope:(initial&&initial.scope)==='groups'?'groups':'mine',
    groupFilters:Array.isArray(initial&&initial.groupFilters)?initial.groupFilters.slice():[],
    collections:Array.isArray(initial&&initial.collections)?initial.collections.slice():[],
    collectionMeta:Object.assign({},(initial&&initial.collectionMeta)||{})
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
    getCollections:function(){return state.collections.slice();},
    setCollections:function(collections){
      state.collections=unique(Array.isArray(collections)?collections.slice():[]);
      return state.collections.slice();
    },
    hasCollection:function(ref){
      return state.collections.indexOf(ref)>=0;
    },
    addCollection:function(ref){
      if(!ref)return false;
      if(state.collections.indexOf(ref)>=0)return false;
      state.collections.push(ref);
      return true;
    },
    normalizeCollections:function(){
      state.collections=unique(state.collections).sort();
      return state.collections.slice();
    },
    removeCollections:function(predicate){
      var fn=typeof predicate==='function'?predicate:function(){return false;};
      state.collections=state.collections.filter(function(ref){return ref&&!(fn(ref));});
      return state.collections.slice();
    },
    getCollectionMeta:function(){
      return Object.assign({},state.collectionMeta);
    },
    getCollectionMetaKeys:function(){
      return Object.keys(state.collectionMeta||{});
    },
    getCollectionMetaEntry:function(ref){
      var entry=state.collectionMeta&&state.collectionMeta[ref];
      return entry?Object.assign({},entry):undefined;
    },
    setCollectionMeta:function(meta){
      state.collectionMeta=Object.assign({},meta||{});
      return this.getCollectionMeta();
    },
    setCollectionMetaEntry:function(ref,meta){
      if(!ref)return undefined;
      state.collectionMeta[ref]=Object.assign({},meta||{});
      return this.getCollectionMetaEntry(ref);
    },
    mergeCollectionMetaEntry:function(ref,meta){
      if(!ref)return undefined;
      state.collectionMeta[ref]=Object.assign({},state.collectionMeta[ref]||{},meta||{});
      return this.getCollectionMetaEntry(ref);
    },
    removeCollectionMetaEntry:function(ref){
      if(!ref)return false;
      if(!Object.prototype.hasOwnProperty.call(state.collectionMeta,ref))return false;
      delete state.collectionMeta[ref];
      return true;
    },
    removeCollectionMetaWhere:function(predicate){
      var fn=typeof predicate==='function'?predicate:function(){return false;};
      Object.keys(state.collectionMeta||{}).forEach(function(ref){
        if(fn(ref,Object.assign({},state.collectionMeta[ref]||{})))delete state.collectionMeta[ref];
      });
      return this.getCollectionMeta();
    },
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
      state.collections=unique(Array.isArray(next&&next.collections)?next.collections.slice():[]);
      state.collectionMeta=Object.assign({},(next&&next.collectionMeta)||{});
      return this.snapshot();
    },
    snapshot:function(){
      return {scope:state.scope,groupFilters:state.groupFilters.slice(),collections:state.collections.slice(),collectionMeta:Object.assign({},state.collectionMeta)};
    }
  };
}

var CollectionState=createCollectionState({scope:'mine',groupFilters:[],collections:[],collectionMeta:{}});
