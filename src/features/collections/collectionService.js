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
function collectionWriteNow(context){
  context=context||{};
  return (context.now||function(){return new Date().toISOString();})();
}
async function persistScopedCollectionWrite(name,meta,context){
  context=context||{};meta=meta||{};
  if(!context.isLoggedIn||!context.isLoggedIn())return;
  var scope=context.collectionScopeInfo&&context.collectionScopeInfo(Object.prototype.hasOwnProperty.call(meta,'owner_group')?meta.owner_group:undefined);
  scope=scope||{};
  if(meta.owner_company)scope.owner_company=meta.owner_company;
  if(meta.owner_type)scope.owner_type=meta.owner_type;
  if(Object.prototype.hasOwnProperty.call(meta,'owner_group'))scope.owner_group=meta.owner_group||'';
  if(!scope.owner_company||!name)return;
  var authUser=context.authUser||{};
  var row={owner_company:scope.owner_company,owner_group:scope.owner_group||'',owner_type:scope.owner_type,name:name,fsd:meta.fsd||null,target_company:scope.owner_company,target_group:meta.group||scope.owner_group||'',created_by:authUser?authUser.id:null,created_by_email:meta.created_by_email||(authUser&&authUser.email)||'',updated_at:collectionWriteNow(context)};
  var repo=context.repository;
  var existing=await repo.findScopedCollection(scope,name);
  if(existing.error)throw existing.error;
  if(existing.data&&existing.data.id){
    if((authUser&&existing.data.created_by===authUser.id)||(context.isCompanyAdmin&&context.isCompanyAdmin())){
      var u=await repo.updateScopedCollectionById(existing.data.id,row);
      if(u.error&&context.missingColumnError&&context.missingColumnError(u.error)){
        var fallback=Object.assign({},row);delete fallback.created_by_email;
        u=await repo.updateScopedCollectionById(existing.data.id,fallback);
      }
      if(u.error)throw u.error;
    }
    return;
  }
  var r=await repo.insertScopedCollection(row);
  if(r.error&&context.missingColumnError&&context.missingColumnError(r.error)){
    var fallbackInsert=Object.assign({},row);delete fallbackInsert.created_by_email;
    r=await repo.insertScopedCollection(fallbackInsert);
  }
  if(r.error)throw r.error;
}
async function persistScopedAssignmentWrite(style,name,action,context){
  context=context||{};
  if(!context.isLoggedIn||!context.isLoggedIn()||!style||!name)return;
  var meta=(context.collectionMetaByRef&&context.collectionMetaByRef(name))||{},collectionName=(context.collectionDisplayName&&context.collectionDisplayName(name,meta))||name;
  var scope=context.collectionScopeInfo&&context.collectionScopeInfo(Object.prototype.hasOwnProperty.call(meta,'owner_group')?meta.owner_group:undefined);
  scope=scope||{};
  if(meta.owner_company)scope.owner_company=meta.owner_company;
  if(meta.owner_type)scope.owner_type=meta.owner_type;
  if(Object.prototype.hasOwnProperty.call(meta,'owner_group'))scope.owner_group=meta.owner_group||'';
  if(!scope.owner_company)return;
  var repo=context.repository;
  if(action==='remove'){
    var d=await repo.deleteStyleAssignment(scope,style.id,collectionName);
    if(d.error)throw d.error;
    return;
  }
  var authUser=context.authUser||{};
  var row={row_id:style.id,owner_company:scope.owner_company,owner_group:scope.owner_group||'',owner_type:scope.owner_type,collection_name:collectionName,created_by:authUser?authUser.id:null};
  var u=await repo.upsertStyleAssignment(row);
  if(u.error)throw u.error;
  var cleanup=await repo.deleteOtherStyleAssignments(scope,style.id,collectionName);
  if(cleanup.error)throw cleanup.error;
}
function collectionWriteScopeFromMeta(meta,context){
  context=context||{};meta=meta||{};
  var scope=context.collectionScopeInfo&&context.collectionScopeInfo(Object.prototype.hasOwnProperty.call(meta,'owner_group')?meta.owner_group:undefined);
  scope=scope||{};
  if(meta.owner_company)scope.owner_company=meta.owner_company;
  if(meta.owner_type)scope.owner_type=meta.owner_type;
  if(Object.prototype.hasOwnProperty.call(meta,'owner_group'))scope.owner_group=meta.owner_group||'';
  return scope;
}
async function renameScopedCollectionRemoteWrite(oldName,newName,meta,oldMeta,context){
  context=context||{};
  if(!context.isLoggedIn||!context.isLoggedIn()||!oldName||!newName)return;
  var scope=collectionWriteScopeFromMeta(oldMeta,context);
  if(!scope.owner_company)return;
  var repo=context.repository;
  var del=await repo.deleteScopedCollection(scope,oldName);
  if(del.error)throw del.error;
  await persistScopedCollectionWrite(newName,meta||{},context);
  var u=await repo.updateStyleAssignmentsCollectionName(scope,oldName,newName);
  if(u.error)throw u.error;
}
async function removeScopedCollectionRemoteWrite(name,meta,context){
  context=context||{};
  if(!context.isLoggedIn||!context.isLoggedIn()||!name)return;
  var scope=collectionWriteScopeFromMeta(meta,context);
  if(!scope.owner_company)return;
  var repo=context.repository;
  var a=await repo.deleteStyleAssignmentsForCollection({
    owner_company:scope.owner_company,
    owner_group:scope.owner_group||'',
    owner_type:scope.owner_type,
    collection_name:name
  });
  if(a.error)throw a.error;
  var c=await repo.deleteScopedCollection(scope,name);
  if(c.error)throw c.error;
}
async function updateCompanyCollectionExplicitWrite(oldMeta,newName,fsd,newGroup,context){
  context=context||{};
  if(!oldMeta||!oldMeta.name)return null;
  var activeCompanyName=context.activeCompanyName||function(){return '';};
  var activeCompanyType=context.activeCompanyType||function(){return 'Brand';};
  var company=oldMeta.owner_company||oldMeta.company||activeCompanyName();
  var type=oldMeta.owner_type||activeCompanyType()||'Brand';
  var oldName=oldMeta.name;
  var oldGroup=oldMeta.owner_group||oldMeta.group||'';
  var row={name:newName,fsd:fsd||null,owner_group:newGroup||'',target_group:newGroup||'',updated_at:collectionWriteNow(context)};
  var repo=context.repository;
  var c=await repo.updateScopedCollectionExplicit({owner_company:company,owner_group:oldGroup,owner_type:type,name:oldName},row);
  if(c.error)throw c.error;
  var a=await repo.updateAssignmentsForCollection({owner_company:company,owner_group:oldGroup,owner_type:type,collection_name:oldName},{collection_name:newName,owner_group:newGroup||''});
  if(a.error)throw a.error;
  return {company:company,type:type,oldName:oldName,oldGroup:oldGroup,newName:newName,newGroup:newGroup||'',row:row};
}
async function deleteCompanyCollectionExplicitWrite(meta,context){
  context=context||{};
  if(!meta||!meta.name)return null;
  var activeCompanyName=context.activeCompanyName||function(){return '';};
  var activeCompanyType=context.activeCompanyType||function(){return 'Brand';};
  var company=meta.owner_company||meta.company||activeCompanyName();
  var type=meta.owner_type||activeCompanyType()||'Brand';
  var group=meta.owner_group||meta.group||'';
  var name=meta.name;
  var repo=context.repository;
  var filters={owner_company:company,owner_group:group,owner_type:type,collection_name:name};
  var a=await repo.deleteStyleAssignmentsForCollection(filters);
  if(a.error)throw a.error;
  var c=meta.id?await repo.deleteScopedCollectionById(meta.id):await repo.deleteScopedCollectionByFilters({owner_company:company,owner_group:group,owner_type:type,name:name});
  if(c.error)throw c.error;
  var check=meta.id?await repo.selectScopedCollectionById(meta.id):await repo.selectScopedCollectionByFilters({owner_company:company,owner_group:group,owner_type:type,name:name});
  if(check.error)throw check.error;
  if((check.data||[]).length)throw new Error('Collection was not deleted from database');
  return {company:company,type:type,group:group,name:name};
}
