var ExploreDomain={
  state:createExploreStateStore(),
  createReadState:createExploreReadState,
  visibleRows:getVisibleExploreRows,
  normalizeSearch:exploreNormalizeSearch,
  matchesSearch:exploreMatchesSearch,
  rowSearchText:exploreRowSearchText,
  matchesExactFilter:exploreMatchesExactFilter
};
(function(root){
  if(!root||!Object.defineProperty)return;
  [
    ['EXPLORE_SEARCH','search'],
    ['SHOWROOM_FILTER_CAT','category'],
    ['SHOWROOM_FILTER_ORIGIN','origin'],
    ['SHOWROOM_SOURCE','source'],
    ['SHOWROOM_SAVED_ONLY','savedOnly'],
    ['SHOWROOM_COLLECTIONS_VIEW','collectionsView']
  ].forEach(function(pair){
    try{
      Object.defineProperty(root,pair[0],{
        configurable:true,
        get:function(){return ExploreDomain.state.snapshot()[pair[1]];},
        set:function(value){ExploreDomain.state.setFilter(pair[1],value);}
      });
    }catch(e){}
  });
})(typeof globalThis!=='undefined'?globalThis:window);
