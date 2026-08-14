(function(root){
  'use strict';

  var MAX_BATCH_SIZE=100;

  function normalizeStyleId(value){
    var n=Number(value);
    if(!Number.isSafeInteger(n)||n<=0)return null;
    return String(n);
  }

  function uniqueStyleIds(values){
    var seen={},ids=[];
    (values||[]).forEach(function(value){
      var key=normalizeStyleId(value);
      if(!key||seen[key])return;
      seen[key]=true;
      ids.push(key);
    });
    return ids;
  }

  function chunkStyleIds(ids){
    var chunks=[];
    for(var i=0;i<ids.length;i+=MAX_BATCH_SIZE)chunks.push(ids.slice(i,i+MAX_BATCH_SIZE));
    return chunks;
  }

  function safeNumber(value){
    return Number.isFinite(Number(value))?Number(value):null;
  }

  function normalizeCostResult(result){
    result=result||{};
    var key=normalizeStyleId(result.styleId);
    return {
      styleId:key,
      status:String(result.status||'ERROR'),
      reason:result.reason||result.error||null,
      fob:safeNumber(result.fob),
      selectedFob:safeNumber(result.selectedFob),
      landedCost:safeNumber(result.landedCost),
      estimatedLandedCost:safeNumber(result.estimatedLandedCost),
      imu:safeNumber(result.imu),
      markup:safeNumber(result.markup),
      gap:safeNumber(result.gap),
      targetFob:safeNumber(result.targetFob),
      freightPerUnit:safeNumber(result.freightPerUnit),
      customs:safeNumber(result.customs),
      customsPct:safeNumber(result.customsPct),
      transitDays:safeNumber(result.transitDays),
      hod:result.hod||null,
      currency:result.currency||'USD',
      source:result.source||'STDTEX_MODEL',
      model:result.model||'cost-model-001',
      formulaVersion:result.formulaVersion||1,
      configurationVersion:result.configurationVersion||null
    };
  }

  function requireClient(options){
    options=options||{};
    var client=options.client||(root.stdtexSupabaseClient&&root.stdtexSupabaseClient())||root.sb;
    if(!client||!client.functions||typeof client.functions.invoke!=='function')throw new Error('SUPABASE_FUNCTIONS_CLIENT_UNAVAILABLE');
    return client;
  }

  async function fetchCostResults(styleIds,options){
    options=options||{};
    var ids=uniqueStyleIds(styleIds);
    var response={results:[],byStyleId:{},batchSizes:[],batchCount:0,requestedCount:ids.length};
    if(!ids.length)return response;
    var client=requireClient(options);
    var chunks=chunkStyleIds(ids);
    response.batchCount=chunks.length;
    for(var i=0;i<chunks.length;i++){
      var chunk=chunks[i];
      response.batchSizes.push(chunk.length);
      var body={styleIds:chunk.map(function(id){return Number(id);})};
      if(options.targetCompanyId)body.targetCompanyId=options.targetCompanyId;
      var invoked=await client.functions.invoke('calculate-style-cost',{body:body});
      if(invoked.error)throw new Error(invoked.error.message||String(invoked.error));
      var data=invoked.data||{};
      if(data.ok===false)throw new Error(data.error||'COST_CALCULATION_FAILED');
      (data.results||[]).forEach(function(raw){
        var normalized=normalizeCostResult(raw);
        if(!normalized.styleId)return;
        response.results.push(normalized);
        response.byStyleId[normalized.styleId]=normalized;
      });
    }
    return response;
  }

  root.StdtexCostingCalculationService={
    MAX_BATCH_SIZE:MAX_BATCH_SIZE,
    normalizeStyleId:normalizeStyleId,
    uniqueStyleIds:uniqueStyleIds,
    normalizeCostResult:normalizeCostResult,
    fetchCostResults:fetchCostResults
  };
})(typeof window!=='undefined'?window:globalThis);
