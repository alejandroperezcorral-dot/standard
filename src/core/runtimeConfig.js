var StdtexRuntimeConfig=(function(root){
  var PROD_REF='vtyffyywmqnlfemzlsbz';
  var PROD_URL='https://vtyffyywmqnlfemzlsbz.supabase.co';
  var PROD_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0eWZmeXl3bXFubGZlbXpsc2J6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNDMxMTUsImV4cCI6MjA5NjkxOTExNX0.w4W0ekk-qAX9lAFAUY7cg5RGVX-iewOiuroPnVzNP30';
  var STAGING_REF='amitkdqyfblymzdsrplx';

  function projectRefFromUrl(url){
    var m=String(url||'').match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/i);
    return m?m[1]:'';
  }

  function decodeJwtPayload(token){
    var parts=String(token||'').split('.');
    if(parts.length<2)return null;
    try{
      var raw=parts[1].replace(/-/g,'+').replace(/_/g,'/');
      while(raw.length%4)raw+='=';
      var json;
      if(typeof atob==='function')json=atob(raw);
      else if(typeof Buffer!=='undefined')json=Buffer.from(raw,'base64').toString('utf8');
      else return null;
      return JSON.parse(json);
    }catch(e){return null;}
  }

  function assertNoServiceRole(config){
    var key=String(config.publishableKey||config.supabasePublishableKey||config.anonKey||config.supabaseAnonKey||'');
    var decoded=decodeJwtPayload(key);
    if(decoded&&decoded.role==='service_role')throw new Error('Refusing to expose a service_role key in browser config.');
    ['serviceRoleKey','service_role','secretKey','supabaseServiceRoleKey'].forEach(function(k){
      if(config[k])throw new Error('Refusing to expose service-role credentials in browser config.');
    });
  }

  function resolve(input){
    var override=input||root.__STDTEX_RUNTIME_CONFIG__||{};
    var env=String(override.environment||override.env||'production').toLowerCase();
    if(env==='production'){
      return {
        environment:'production',
        projectRef:PROD_REF,
        supabaseUrl:PROD_URL,
        publishableKey:PROD_KEY,
        proxySupabaseThroughSameOrigin:true,
        proxyPath:'/sb'
      };
    }
    if(env!=='staging')throw new Error('Unknown STDTEX runtime environment: '+env);
    assertNoServiceRole(override);
    var url=String(override.supabaseUrl||'').trim();
    var key=String(override.publishableKey||override.supabasePublishableKey||override.anonKey||override.supabaseAnonKey||'').trim();
    var ref=String(override.projectRef||projectRefFromUrl(url)||'').trim();
    if(!url||!key||!ref)throw new Error('Staging runtime config is incomplete.');
    if(ref!==STAGING_REF)throw new Error('Staging runtime must target '+STAGING_REF+'.');
    if(url.indexOf(PROD_REF)>=0)throw new Error('Staging runtime cannot target production Supabase.');
    if(projectRefFromUrl(url)!==STAGING_REF)throw new Error('Staging Supabase URL does not match '+STAGING_REF+'.');
    return {
      environment:'staging',
      projectRef:STAGING_REF,
      supabaseUrl:url,
      publishableKey:key,
      proxySupabaseThroughSameOrigin:false,
      proxyPath:''
    };
  }

  var api={
    resolve:resolve,
    projectRefFromUrl:projectRefFromUrl,
    constants:{productionRef:PROD_REF,stagingRef:STAGING_REF,productionUrl:PROD_URL}
  };
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.StdtexRuntimeConfig=api;
  return api;
})(typeof window!=='undefined'?window:globalThis);
