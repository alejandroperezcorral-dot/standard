function isSupplierShowroomStyle(row){
  var notes=(row&&row.notes)||'';
  return (row&&row.source)==='SUPPLIER'||(row&&row.product_source)==='SUPPLIER'||/\[SOURCE:SUPPLIER\]/.test(notes);
}
function styleStatus(row){
  if(!row)return 'PENDING';
  return row.status==='CLOSED'?'CLOSED':'PENDING';
}
function styleSource(row){
  var notes=(row&&row.notes)||'';
  var match=notes.match(/\[SOURCE:([A-Z]+)\]/);
  return (row&&row.source)||row.product_source||(match?match[1]:'BUYER');
}
function isOpenStyle(row){
  return styleStatus(row)==='PENDING';
}
function noteTagValueForStyle(row,key){
  var notes=String((row&&row.notes)||''),re=new RegExp('\\['+key+':([\\s\\S]*?)\\]');
  var match=notes.match(re);
  if(!match)return '';
  try{return decodeURIComponent(match[1]);}catch(e){return match[1]||'';}
}
function styleSupplierReference(row){
  return noteTagValueForStyle(row,'SUPPLIER_REF')||(row&&row.supplier_ref)||((row&&styleSource(row)==='SUPPLIER')?(row.modelo||''):'');
}
function styleFabricReference(row){
  return noteTagValueForStyle(row,'FABRIC_REF')||(row&&row.fabric_ref)||'';
}
function styleParentBrandLink(row){
  return parseStyleNoteJsonTag(row,'PARENT_BRAND_STYLE',null)||null;
}
function styleBrandResponseLinks(row,rows){
  var id=String(row&&row.id||''),styleId=String(row&&(row.style_id||row.canonical_style_id)||'');
  if(!id&&!styleId)return [];
  return (rows||[]).filter(function(candidate){
    var link=styleParentBrandLink(candidate);
    if(!link)return false;
    return (id&&String(link.parentRowId||'')===id)||(styleId&&String(link.parentStyleId||'')===styleId);
  });
}
function styleIsBrandParent(row){
  return !!row&&styleSource(row)!=='SUPPLIER'&&!styleParentBrandLink(row);
}
function styleIsSupplierResponse(row){
  return !!styleParentBrandLink(row);
}
function styleLifecycleMetadata(row){
  return {supplierRef:styleSupplierReference(row),fabricRef:styleFabricReference(row),parentBrandStyle:styleParentBrandLink(row)};
}
function baseStyleNotes(notes){
  return String(notes||'').replace(/\n?\[(CHAT|FILES|COLLECTIONS|BRAND_COLLECTIONS|SUPPLIER_REF|FABRIC_REF|PARENT_BRAND_STYLE|SHARED_BRANDS|SHARED_BRANDS_TEXT):[\s\S]*?\]/g,'').trim();
}
function parseStyleNoteJsonTag(row,key,fallback){
  var notes=String((row&&row.notes)||''),match=notes.match(new RegExp('\\['+key+':([\\s\\S]*?)\\]'));
  if(!match)return fallback;
  try{return JSON.parse(decodeURIComponent(match[1]))||fallback;}catch(e){return fallback;}
}
function styleChatMessagesFromNotes(row){
  return parseStyleNoteJsonTag(row,'CHAT',[]);
}
function styleFilesFromNotes(row){
  return parseStyleNoteJsonTag(row,'FILES',[]);
}
function styleSharedBrandsFromNotes(row){
  return parseStyleNoteJsonTag(row,'SHARED_BRANDS',[]);
}
function styleCollectionNames(row){
  var out=parseStyleNoteJsonTag(row,'COLLECTIONS',[]);
  var capsule=(row&&row.capsule||'').trim();
  if(capsule&&capsule!=='Supplier Showroom'&&out.indexOf(capsule)<0)out.push(capsule);
  return out.filter(function(value,index,array){return value&&array.indexOf(value)===index;});
}
function styleBrandCollectionMapFromNotes(row){
  return parseStyleNoteJsonTag(row,'BRAND_COLLECTIONS',{});
}
function styleFromNegotiationRow(row){
  return {
    id:row.id,fecha:row.fecha,modelo:row.modelo,colour:row.colour||'',desc:row.description,
    supplier:row.supplier,origin:row.origin,transport:row.transport,temporada:row.temporada,
    dept:row.dept,cat:row.cat,pvp_rub:row.pvp_rub,fob1:row.fob1,fob2:row.fob2,
    fob3:row.fob3,fob_closed:row.fob_closed,weight:row.weight,units:row.units,
    target_imu:row.target_imu,notes:row.notes,status:row.status||null,
    fsd:row.fsd,hod:row.hod||'',ch_off:row.ch_off,ch_mkt:row.ch_mkt,ch_onl:row.ch_onl,
    sell_thru:row.sell_thru,lc_weeks:row.lc_weeks,photo:row.photo,photo2:row.photo2,
    cust_profile:row.cust_profile,capsule:row.capsule,fashionability:row.fashionability,
    n_colours:row.n_colours,user_id:row.user_id||null,
    folder_id:row.folder_id||null
  };
}
