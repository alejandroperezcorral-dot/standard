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
