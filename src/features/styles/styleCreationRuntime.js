var StyleCreationRuntime=(function(){
  var state={tab:'CREATED',created:[],loading:false,lastCanonicalAvailable:null};

  function esc(value){
    return typeof escHtml==='function'?escHtml(value):String(value||'').replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];});
  }

  function currentCompanyName(){
    if(typeof activeCompanyName==='function')return activeCompanyName();
    var p=window.AUTH_PROFILE||{};
    return p.active_company_name||p.company_name||p.supplier_company||'';
  }

  function currentCompanyType(){
    if(typeof activeCompanyType==='function')return activeCompanyType();
    var p=window.AUTH_PROFILE||{};
    return p.company_type||'Brand';
  }

  function canonicalAvailableError(error){
    var msg=String(error&&(error.message||error.details||error.code)||'').toLowerCase();
    return msg.indexOf('relation')>=0||msg.indexOf('does not exist')>=0||msg.indexOf('schema cache')>=0||msg.indexOf('column')>=0;
  }

  function repository(){
    if(!window.sb||!StylesDomain.creation.createRepository)return null;
    return StylesDomain.creation.createRepository(window.sb);
  }

  function legacyCreatedRows(){
    var rows=window.ROWS||[],email=(window.AUTH_USER&&AUTH_USER.email)||'',uid=(window.AUTH_USER&&AUTH_USER.id)||'';
    var company=currentCompanyName(),type=normalizeStyleCreatedByType(currentCompanyType());
    return rows.filter(function(row){
      if(!row)return false;
      if(uid&&row.user_id&&String(row.user_id)===String(uid))return true;
      var source=normalizeStyleCreatedByType(row.source||row.product_source||styleSource(row));
      if(type==='SUPPLIER')return source==='SUPPLIER'&&String(row.supplier||'').toLowerCase()===String(company||'').toLowerCase();
      return source==='BRAND'&&String(row.created_by_email||'').toLowerCase()===String(email||'').toLowerCase();
    }).map(function(row){
      return canonicalStyleFromNegotiationRow(row,{
        ownerCompanyName:company,
        createdByEmail:email,
        createdByType:styleSource(row),
        ownerCompanyId:(AUTH_PROFILE&&(AUTH_PROFILE.company_id||AUTH_PROFILE.active_company_id))||null
      });
    });
  }

  async function loadCreatedStyles(){
    state.loading=true;
    var repo=repository();
    if(repo&&StylesDomain.creation.service){
      try{
        var result=await StylesDomain.creation.service.getCreatedStyles({repository:repo,profile:window.AUTH_PROFILE||{}});
        if(result.error)throw result.error;
        state.created=result.data||[];
        state.lastCanonicalAvailable=true;
        state.loading=false;
        return;
      }catch(error){
        if(!canonicalAvailableError(error))console.warn('My Styles canonical load failed',error);
        state.lastCanonicalAvailable=false;
      }
    }
    state.created=legacyCreatedRows();
    state.loading=false;
  }

  function mainImage(style){
    if(!style)return '';
    if(Array.isArray(style.images)&&style.images.length){
      var main=style.images.filter(function(img){return img&&img.main;})[0]||style.images[0];
      return main&&main.url||'';
    }
    var attrs=style.master_attributes||{};
    return style.main_image||attrs.main_image||style.photo||'';
  }

  function styleTitle(style){
    var attrs=style.master_attributes||{};
    return style.title||style.name||attrs.description||style.description||attrs.style_ref||style.style_ref||'Untitled style';
  }

  function styleRef(style){
    var attrs=style.master_attributes||{};
    return style.style_ref||attrs.style_ref||style.style_id||style.id||'';
  }

  function styleMeta(style){
    var attrs=style.master_attributes||{};
    var company=style.owner_company_name||style.creator_company_name||attrs.supplier||currentCompanyName();
    var origin=attrs.origin||style.origin||'';
    return [company,origin,style.created_by_type||''].filter(Boolean).join(' - ');
  }

  function renderCard(style){
    var img=mainImage(style),id=style.legacy_negotiation_row_id||style.style_id||style.id;
    return '<button class="style-card my-style-card" onclick="StyleCreationRuntime.openStyle(\''+esc(id)+'\')">'
      +'<div class="style-img">'+(img?'<img src="'+esc(img)+'" alt="" loading="lazy" decoding="async">':'<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>')+'</div>'
      +'<b>'+esc(styleRef(style))+'</b><h3>'+esc(styleTitle(style))+'</h3><p>'+esc(styleMeta(style))+'</p>'
      +'<small>'+esc(style.lifecycle_state||'ACTIVE')+'</small></button>';
  }

  async function renderMyStylesPage(){
    var body=document.getElementById('styles-page-body');
    if(!body)return;
    if(!window.AUTH_USER){
      body.innerHTML='<div class="empty-showroom">Sign in to view My Styles.</div>';
      return;
    }
    body.innerHTML='<div class="platform-page-head"><div><h2>My Styles</h2><p>Your company-created style library. Created is not Saved.</p></div><button class="platform-primary" onclick="StyleCreationRuntime.openCreateStyle()">New Style</button></div><div class="collections-tabs"><button class="on">Created</button><button disabled>Shared with us</button><button disabled>Archived</button></div><div class="empty-showroom">Loading styles...</div>';
    await loadCreatedStyles();
    var created=state.created.filter(function(style){return !canonicalStyleArchived(style);});
    var note=state.lastCanonicalAvailable===false?'<p class="collections-intro">Canonical table is not active yet, showing compatible created styles from negotiation rows.</p>':'';
    var h='<div class="platform-page-head"><div><h2>My Styles</h2><p>Your company-created style library. Created is not Saved.</p></div><button class="platform-primary" onclick="StyleCreationRuntime.openCreateStyle()">New Style</button></div>';
    h+='<div class="collections-tabs"><button class="on">Created</button><button disabled>Shared with us</button><button disabled>Archived</button></div>'+note;
    if(!created.length)h+='<div class="first-collection-empty"><b>No created styles yet.</b><span>Create a private style for '+esc(currentCompanyName()||'your company')+'.</span><button onclick="StyleCreationRuntime.openCreateStyle()">Create first style</button></div>';
    else h+='<div class="showroom-grid">'+created.map(renderCard).join('')+'</div>';
    body.innerHTML=h;
  }

  function openCreateStyle(){
    if(typeof openCreateModelModal==='function')return openCreateModelModal(normalizeStyleCreatedByType(currentCompanyType())==='SUPPLIER'?'SUPPLIER':'BUYER');
  }

  function openStyle(id){
    var row=(window.ROWS||[]).filter(function(r){return String(r.id)===String(id);})[0];
    if(row&&typeof openStyleChat==='function')openStyleChat(row.id);
  }

  async function persistCanonicalForLegacyRow(row,input){
    var repo=repository();
    if(!repo||!StylesDomain.creation.service||!window.AUTH_USER)return null;
    try{
      input=input||{};
      var createdByType=normalizeStyleCreatedByType(row&&row.source||row&&row.product_source||styleSource(row));
      var style=await StylesDomain.creation.service.createStyle(input||{},{
        repository:repo,
        user:window.AUTH_USER,
        profile:window.AUTH_PROFILE||{},
        createdByType:createdByType
      });
      if(row&&style&&style.id){
        row.style_id=style.id;
        row.canonical_style_id=style.id;
        try{await repo.linkNegotiationRow(row.id,style.id);}catch(linkError){
          if(!canonicalAvailableError(linkError))console.warn('Style legacy link failed',linkError);
        }
        if(createdByType==='BRAND'){
          try{
            var company=StylesDomain.creation.service.profileCompany(window.AUTH_PROFILE||{});
            var brandContext=await StylesDomain.creation.service.getOrCreateBrandStyleContext({
              brandCompanyId:company.id,
              styleId:style.id,
              departmentId:input.departmentId||input.department_id||null,
              categoryId:input.categoryId||input.category_id||null,
              targetPrice:input.targetPrice||input.target_price||input.fob||null,
              targetCurrency:input.targetCurrency||input.target_currency||'USD',
              internalStatus:input.status||'PENDING'
            },{
              repository:repo,
              user:window.AUTH_USER,
              profile:window.AUTH_PROFILE||{}
            });
            if(row&&brandContext&&brandContext.id)row.brand_style_context_id=brandContext.id;
            if(row&&brandContext){
              row.brand_style_context_missing_taxonomy=!(brandContext.department_id&&brandContext.category_id);
            }
          }catch(contextError){
            if(!canonicalAvailableError(contextError))console.warn('Brand style context save failed',contextError);
          }
        }
      }
      return style;
    }catch(error){
      if(!canonicalAvailableError(error))console.warn('Canonical style save failed',error);
      return null;
    }
  }

  return {
    renderMyStylesPage:renderMyStylesPage,
    openCreateStyle:openCreateStyle,
    openStyle:openStyle,
    persistCanonicalForLegacyRow:persistCanonicalForLegacyRow,
    _state:state
  };
})();
