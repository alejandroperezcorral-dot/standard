function collectionModelNorm(value){
  return String(value||'').trim().toLowerCase();
}
function collectionModelUnique(values){
  var out=[];
  (values||[]).forEach(function(value){
    value=String(value||'').trim();
    if(value&&out.indexOf(value)<0)out.push(value);
  });
  return out;
}
function collectionScopeKeyFromPartsModel(type,company,group,normalizeName){
  var norm=normalizeName||collectionModelNorm;
  type=String(type||'Brand').toLowerCase();
  var key=type+':'+norm(company||'');
  group=norm(group||'');
  return group?key+':'+group:key;
}
function collectionScopePartsFromKeyModel(key){
  var parts=String(key||'').split(':'),type=parts[0]||'',company=parts[1]||'',group=parts.slice(2).join(':');
  return {type:type,company:company,group:group};
}
function collectionNameFromStoreKeyModel(key,currentScopeKey){
  key=String(key||'');
  var prefix=String(currentScopeKey||'')+'::';
  if(currentScopeKey&&key.indexOf(prefix)===0)return key.slice(prefix.length);
  return key.indexOf('::')>=0?key.split('::').slice(1).join('::'):key;
}
function collectionDisplayNameModel(ref,meta,currentScopeKey){
  meta=meta||{};
  return String(meta.name||collectionNameFromStoreKeyModel(ref,currentScopeKey)||ref||'').trim();
}
function normalizeCollectionMetaModel(ref,meta,currentScopeKey){
  meta=meta||{};
  var name=collectionDisplayNameModel(ref,meta,currentScopeKey);
  var scope=meta.scope||'';
  if(!scope&&String(ref||'').indexOf('::')>=0)scope=String(ref).split('::')[0];
  var parts=scope?collectionScopePartsFromKeyModel(scope):{};
  return {
    id:meta.id||ref||name,
    name:name,
    displayName:name,
    ownerCompany:meta.owner_company||meta.company||parts.company||'',
    ownerType:meta.owner_type||parts.type||'Brand',
    group:meta.owner_group||meta.group||parts.group||'',
    fsd:meta.fsd||'',
    createdBy:meta.created_by||'',
    createdByEmail:meta.created_by_email||'',
    scope:scope,
    source:meta.source||''
  };
}
function supplierCollectionLabelModel(collections,isSupplierOwned){
  collections=collectionModelUnique(collections);
  return isSupplierOwned&&collections.length?collections.join(', '):'No collection';
}
function brandCollectionMapHasNameForMetaModel(map,meta,name,normalizeName){
  map=map||{};meta=meta||{};
  var norm=normalizeName||collectionModelNorm;
  var type=String(meta.owner_type||'Brand').toLowerCase(),company=norm(meta.owner_company||meta.company||''),group=norm(meta.owner_group||meta.group||''),exact=collectionScopeKeyFromPartsModel(type,company,group,norm);
  if((map[exact]||[]).indexOf(name)>=0)return true;
  return Object.keys(map).some(function(k){
    var cols=map[k]||[];
    if(cols.indexOf(name)<0)return false;
    var p=collectionScopePartsFromKeyModel(k);
    if(p.type!==type||p.company!==company)return false;
    if(p.group===group)return true;
    return !!(group&&!p.group);
  });
}
function assignmentMatchesCollectionMetaModel(assignment,meta,name,normalizeName){
  if(!assignment||!meta)return false;
  var norm=normalizeName||collectionModelNorm;
  if(String(assignment.collection_name||'').trim().toLowerCase()!==String(name||'').trim().toLowerCase())return false;
  var type=String(meta.owner_type||'Brand'),company=norm(meta.owner_company||meta.company||''),group=norm(meta.owner_group||meta.group||'');
  if(String(assignment.owner_type||'Brand')!==type)return false;
  if(norm(assignment.owner_company||'')!==company)return false;
  var assignmentGroup=norm(assignment.owner_group||'');
  return assignmentGroup===group||!!(group&&!assignmentGroup);
}
function collectionCreatedByUserModel(meta,userId,userEmail,creatorEmail,normalizeName){
  meta=meta||{};
  var norm=normalizeName||collectionModelNorm;
  if(!userId&&!userEmail)return false;
  if(meta.created_by)return meta.created_by===userId;
  return !!(creatorEmail&&userEmail&&norm(creatorEmail)===norm(userEmail));
}
function collectionOwnedByCompanyModel(meta,context,normalizeName){
  meta=meta||{};context=context||{};
  var norm=normalizeName||collectionModelNorm;
  if(context.adminBypass)return true;
  var company=meta.owner_company||meta.company||'',type=meta.owner_type||context.activeCompanyType||'Brand';
  if(!company||norm(company)!==norm(context.activeCompanyName||''))return false;
  if(String(type)!==String(context.activeCompanyType||'Brand'))return false;
  return true;
}
function collectionKeyVisibleModel(key,context,normalizeName){
  key=String(key||'');context=context||{};
  var norm=normalizeName||collectionModelNorm;
  if(key.indexOf('::')<0)return !!context.legacySupplierVisible;
  var scope=key.split('::')[0],parts=collectionScopePartsFromKeyModel(scope);
  if(context.adminBypass)return true;
  if(parts.type!==String(context.ownerType||'Brand').toLowerCase())return false;
  if(parts.company!==norm(context.ownerCompany||''))return false;
  if(!parts.group)return true;
  return (context.userGroups||[]).some(function(group){return norm(group)===parts.group;});
}
function collectionSummaryModel(rows,metricsForRow){
  var units=0,imu=0,countWithImu=0;
  (rows||[]).forEach(function(row){
    units+=parseFloat(row&&row.units)||0;
    var metrics=metricsForRow?metricsForRow(row):{};
    if(isFinite(metrics&&metrics.imu)){imu+=metrics.imu;countWithImu++;}
  });
  return {units:units,imu:countWithImu?imu/countWithImu:0,count:(rows||[]).length};
}
function sortCollectionRefsModel(refs,displayNameForRef){
  return (refs||[]).slice().sort(function(a,b){
    return String(displayNameForRef?displayNameForRef(a):a||'').localeCompare(String(displayNameForRef?displayNameForRef(b):b||''));
  });
}
