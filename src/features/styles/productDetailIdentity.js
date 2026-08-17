function productDetailIdentityValue(value){
  if(value===0)return '0';
  return value==null?'':String(value);
}

function productDetailIdentityNumericId(value){
  if(typeof value==='number'&&isFinite(value))return value;
  if(typeof value==='string'&&/^\d+$/.test(value.trim()))return parseInt(value,10);
  return null;
}

function productDetailIdentityUuidLike(value){
  value=productDetailIdentityValue(value).trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function productDetailStyleIdFromRow(row){
  if(!row)return '';
  return productDetailIdentityValue(row.style_id||row.canonical_style_id||'');
}

function productDetailCanonicalIdFromStyle(style){
  if(!style)return '';
  return productDetailIdentityValue(style.id||style.style_id||'');
}

function resolveProductDetailIdentity(input,context){
  context=context||{};
  var rows=Array.isArray(context.rows)?context.rows:[];
  var result={
    ok:false,
    reason:'UNRESOLVED',
    rowId:null,
    styleId:'',
    brandStyleContextId:'',
    legacyRow:null,
    canonicalStyle:null,
    workspace:''
  };
  var explicit=typeof input==='object'&&input!==null;
  var rowId=explicit?productDetailIdentityNumericId(input.rowId):productDetailIdentityNumericId(input);
  var styleId=explicit?productDetailIdentityValue(input.styleId||input.style_id||''):'';
  var canonicalStyle=explicit?(input.canonicalStyle||input.style||null):null;
  var brandStyleContextId=explicit?productDetailIdentityValue(input.brandStyleContextId||input.brand_style_context_id||''):'';
  var workspace=explicit?productDetailIdentityValue(input.workspace||''):'';

  if(canonicalStyle&&!styleId)styleId=productDetailCanonicalIdFromStyle(canonicalStyle);

  if(rowId!==null){
    var row=rows.filter(function(r){return r&&r.id===rowId;})[0]||null;
    if(!row){
      result.reason='ROW_NOT_FOUND';
      result.rowId=rowId;
      result.styleId=styleId;
      result.brandStyleContextId=brandStyleContextId;
      result.canonicalStyle=canonicalStyle;
      result.workspace=workspace;
      return result;
    }
    var rowStyleId=productDetailStyleIdFromRow(row);
    result.ok=true;
    result.reason='ROW';
    result.rowId=row.id;
    result.styleId=styleId||rowStyleId;
    result.brandStyleContextId=brandStyleContextId||productDetailIdentityValue(row.brand_style_context_id||'');
    result.legacyRow=row;
    result.canonicalStyle=canonicalStyle;
    result.workspace=workspace;
    return result;
  }

  if(styleId){
    var matches=rows.filter(function(r){return r&&productDetailStyleIdFromRow(r)===styleId;});
    if(matches.length>1){
      result.reason='AMBIGUOUS_STYLE_ROWS';
      result.styleId=styleId;
      result.brandStyleContextId=brandStyleContextId;
      result.canonicalStyle=canonicalStyle;
      result.workspace=workspace;
      return result;
    }
    result.ok=true;
    result.reason=matches.length?'STYLE_WITH_ROW':'STYLE_ONLY';
    result.rowId=matches.length?matches[0].id:null;
    result.styleId=styleId;
    result.brandStyleContextId=brandStyleContextId||(matches.length?productDetailIdentityValue(matches[0].brand_style_context_id||''):'');
    result.legacyRow=matches[0]||null;
    result.canonicalStyle=canonicalStyle;
    result.workspace=workspace;
    return result;
  }

  if(!explicit&&productDetailIdentityUuidLike(input)){
    result.reason='STYLE_NOT_EXPLICIT';
    result.styleId=productDetailIdentityValue(input);
    return result;
  }

  return result;
}

var ProductDetailIdentity={
  resolve:resolveProductDetailIdentity,
  numericId:productDetailIdentityNumericId,
  uuidLike:productDetailIdentityUuidLike,
  rowStyleId:productDetailStyleIdFromRow,
  canonicalStyleId:productDetailCanonicalIdFromStyle
};
