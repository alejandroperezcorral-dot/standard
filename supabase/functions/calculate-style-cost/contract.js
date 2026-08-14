(function(root){
  'use strict';

  var MAX_STYLE_IDS=100;
  var PLATFORM_ADMIN_EMAIL='hello@athletestandards.com';
  var FORBIDDEN_RESPONSE_KEYS=[
    'base_config','baseConfig','config','configuration','dutyRows','dutyOverrides',
    'freightRoutes','assumptions','resolutionTrace','service_role','serviceRole',
    'jwt','token','fx','fxConfig','rawConfig','additionalComponents'
  ];

  function normalizeText(value){
    return value==null?'':String(value).trim();
  }

  function normalizeLower(value){
    return normalizeText(value).toLowerCase();
  }

  function isPlatformAdmin(user,profile){
    var email=normalizeLower(user&&user.email);
    if(email===PLATFORM_ADMIN_EMAIL)return true;
    return normalizeLower(profile&&profile.role)==='admin'||normalizeText(profile&&profile.access_role)==='Platform Admin';
  }

  function normalizeStyleIds(input){
    if(!Array.isArray(input))return {ok:false,error:'STYLE_IDS_REQUIRED',styleIds:[]};
    if(input.length<1)return {ok:false,error:'STYLE_IDS_REQUIRED',styleIds:[]};
    if(input.length>MAX_STYLE_IDS)return {ok:false,error:'STYLE_IDS_LIMIT_EXCEEDED',styleIds:[]};
    var seen={};
    var styleIds=[];
    for(var i=0;i<input.length;i++){
      var raw=input[i];
      if(raw==null||raw==='')return {ok:false,error:'INVALID_STYLE_ID',styleIds:[]};
      var n=Number(raw);
      if(!Number.isSafeInteger(n))return {ok:false,error:'INVALID_STYLE_ID',styleIds:[]};
      var key=String(n);
      if(!seen[key]){
        seen[key]=true;
        styleIds.push(n);
      }
    }
    return {ok:true,error:null,styleIds:styleIds};
  }

  function groupAllowed(scope, groupName){
    var group=normalizeLower(groupName);
    if(!group)return true;
    return !!(scope&&scope.groupNames&&scope.groupNames[group]);
  }

  function styleIsAuthorized(style,scope){
    if(!style||!scope)return false;
    if(scope.platformAdmin)return true;
    var company=scope.company||{};
    var companyType=normalizeLower(company.type);
    var companyName=normalizeLower(company.name);
    var supplier=normalizeLower(style.supplier);
    var styleUserId=normalizeText(style.user_id);

    if(styleUserId&&scope.companyUserIds&&scope.companyUserIds[styleUserId])return true;

    if(companyType==='supplier'&&supplier&&supplier===companyName)return true;

    if(companyType==='brand'&&supplier&&scope.supplierAccess&&scope.supplierAccess[supplier]){
      var accessRows=scope.supplierAccess[supplier]||[];
      for(var i=0;i<accessRows.length;i++){
        if(groupAllowed(scope, accessRows[i].group_name))return true;
      }
    }

    if(scope.collectionAssignments&&scope.collectionAssignments[String(style.id)]){
      var assignments=scope.collectionAssignments[String(style.id)]||[];
      for(var j=0;j<assignments.length;j++){
        var a=assignments[j]||{};
        if(normalizeLower(a.owner_company)===companyName
          && normalizeLower(a.owner_type||'Brand')===companyType
          && groupAllowed(scope,a.owner_group)){
          return true;
        }
      }
    }

    return false;
  }

  function noCostResult(styleId, status, reason, fob){
    return {
      styleId:styleId,
      status:status||'NOT_AVAILABLE',
      reason:reason||null,
      fob:fob==null?null:fob,
      source:'STDTEX_MODEL',
      model:'cost-model-001',
      formulaVersion:1
    };
  }

  function safeNumber(value){
    return Number.isFinite(Number(value))?Number(value):null;
  }

  function sanitizeCostResult(styleId, result, meta){
    result=result||{};
    meta=meta||{};
    return {
      styleId:styleId,
      status:'READY',
      fob:safeNumber(result.fob),
      selectedFob:safeNumber(result.selectedFob),
      landedCost:safeNumber(result.landedCost),
      estimatedLandedCost:safeNumber(result.estimatedLandedCost!=null?result.estimatedLandedCost:result.landedCost),
      imu:safeNumber(result.imu),
      markup:safeNumber(result.mu!=null?result.mu:result.markup),
      gap:safeNumber(result.gap),
      targetFob:safeNumber(result.fobT!=null?result.fobT:result.targetFob),
      freightPerUnit:safeNumber(result.cu!=null?result.cu:result.freightPerUnit),
      customs:safeNumber(result.cust!=null?result.cust:result.customs),
      customsPct:safeNumber(result.custPct!=null?result.custPct:result.customsPct),
      transitDays:safeNumber(result.days!=null?result.days:result.transitDays),
      hod:result.hod||null,
      currency:meta.currency||'USD',
      source:'STDTEX_MODEL',
      model:'cost-model-001',
      formulaVersion:1,
      configurationVersion:meta.configurationVersion||null
    };
  }

  function responseContainsForbiddenKey(value){
    if(value==null||typeof value!=='object')return false;
    if(Array.isArray(value)){
      for(var i=0;i<value.length;i++)if(responseContainsForbiddenKey(value[i]))return true;
      return false;
    }
    var keys=Object.keys(value);
    for(var j=0;j<keys.length;j++){
      if(FORBIDDEN_RESPONSE_KEYS.indexOf(keys[j])>=0)return true;
      if(responseContainsForbiddenKey(value[keys[j]]))return true;
    }
    return false;
  }

  var api={
    MAX_STYLE_IDS:MAX_STYLE_IDS,
    PLATFORM_ADMIN_EMAIL:PLATFORM_ADMIN_EMAIL,
    normalizeText:normalizeText,
    normalizeLower:normalizeLower,
    isPlatformAdmin:isPlatformAdmin,
    normalizeStyleIds:normalizeStyleIds,
    styleIsAuthorized:styleIsAuthorized,
    noCostResult:noCostResult,
    sanitizeCostResult:sanitizeCostResult,
    responseContainsForbiddenKey:responseContainsForbiddenKey
  };

  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.StdtexCostingEdgeContract=api;
})(typeof globalThis!=='undefined'?globalThis:this);
