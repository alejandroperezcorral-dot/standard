function getVisibleExploreRows(input){
  input=input||{};
  var rows=input.rows||[];
  var state=createExploreReadState(input.state||{});
  var context=input.context||{};
  var rowStatus=context.rowStatus||function(row){return row&&row.status==='CLOSED'?'CLOSED':'PENDING';};
  var sourceLabel=context.sourceLabel||function(row){return (row&&row.source)||row&&row.product_source||'BUYER';};
  var styleSharedWithActiveCompany=context.styleSharedWithActiveCompany||function(){return false;};
  var canAccessRow=context.canAccessRowForCurrentUser||function(){return true;};
  var currentStyleCollections=context.currentStyleCollections||function(){return [];};
  var styleAssignedToCurrentBrandCollection=context.styleAssignedToCurrentBrandCollection||function(){return false;};
  return rows.filter(function(row){
    var st=rowStatus(row);
    styleSharedWithActiveCompany(row);
    if(state.hasAuthProfile&&(!state.adminBypass||state.adminViewActive)&&!canAccessRow(row))return false;
    if(!state.loggedIn){
      if(sourceLabel(row)!=='SUPPLIER')return false;
    }
    if(state.status&&st!==state.status)return false;
    if(state.source&&sourceLabel(row)!==state.source)return false;
    if(state.collectionsView&&state.activeCollection&&currentStyleCollections(row).indexOf(state.activeCollection)<0)return false;
    if(!state.collectionsView&&styleAssignedToCurrentBrandCollection(row))return false;
    if(state.savedOnly&&state.savedIds.indexOf(parseInt(row&&row.id))<0)return false;
    if(!exploreMatchesExactFilter(row,'supplier',state.supplier))return false;
    if(!exploreMatchesExactFilter(row,'temporada',state.season))return false;
    if(!exploreMatchesExactFilter(row,'dept',state.department))return false;
    if(!exploreMatchesExactFilter(row,'cat',state.category))return false;
    if(!exploreMatchesExactFilter(row,'origin',state.origin))return false;
    if(!exploreMatchesSearch(row,state.search,context))return false;
    return true;
  });
}
