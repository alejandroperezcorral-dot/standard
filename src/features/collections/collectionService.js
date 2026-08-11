function collectionRowsForMetaRead(meta,context){
  meta=meta||{};context=context||{};
  var rows=context.rows||[],assignments=context.assignments||[];
  var normalizeName=context.normalizeName||collectionModelNorm;
  var matchesAssignment=context.assignmentMatchesCollectionMeta||function(a,m,n){return CollectionsDomain.assignmentMatchesMeta(a,m,n,normalizeName);};
  var styleCollectionsForRow=context.styleCollections||function(){return [];};
  var styleBrandCollectionMapForRow=context.styleBrandCollectionMap||function(){return {};};
  var brandMapHasName=context.brandCollectionMapHasNameForMeta||function(map,m,n){return CollectionsDomain.brandMapHasNameForMeta(map,m,n,normalizeName);};
  var name=meta.name||'',type=meta.owner_type||'Brand',company=meta.owner_company||'';
  var assignedIds={};
  assignments.forEach(function(assignment){
    if(matchesAssignment(assignment,meta,name))assignedIds[String(assignment.row_id)]=true;
  });
  return rows.filter(function(row){
    if(String(type)==='Supplier')return normalizeName(row&&row.supplier)===normalizeName(company)&&styleCollectionsForRow(row).indexOf(name)>=0;
    if(assignedIds[String(row&&row.id)])return true;
    return brandMapHasName(styleBrandCollectionMapForRow(row),meta,name);
  });
}
function collectionRowsRead(name,context){
  context=context||{};
  var rows=context.rows||[];
  var collectionMetaByRef=context.collectionMetaByRef||function(){return {};};
  var collectionDisplayName=context.collectionDisplayName||function(ref,meta){return CollectionsDomain.displayName(ref,meta);};
  var collectionOwnedByActiveCompany=context.collectionOwnedByActiveCompany||function(){return true;};
  var collectionRowsForMetaFn=context.collectionRowsForMeta||function(meta){return collectionRowsForMetaRead(meta,context);};
  var currentStyleCollections=context.currentStyleCollections||function(){return [];};
  var canAccessRow=context.canAccessRowForCurrentUser||function(){return true;};
  var meta=collectionMetaByRef(name)||{},display=collectionDisplayName(name,meta);
  if(meta.name&&!collectionOwnedByActiveCompany(meta))return [];
  var result=(meta&&meta.name)?collectionRowsForMetaFn(meta):rows.filter(function(row){return currentStyleCollections(row).indexOf(display)>=0;});
  return result.filter(function(row){return !context.authProfile||context.adminBypass||canAccessRow(row);});
}
