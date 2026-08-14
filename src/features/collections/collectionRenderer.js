function collectionRendererEsc(value,helpers){
  helpers=helpers||{};
  return (helpers.escHtml||function(v){return String(v==null?'':v);})(value);
}
function collectionRendererNorm(value,helpers){
  helpers=helpers||{};
  return (helpers.normalizeName||function(v){return String(v||'').trim().toLowerCase();})(value);
}
function collectionAdminGroupOptionsHtml(args){
  args=args||{};
  var groups=args.groups||[],selected=args.selected||'',helpers=args.helpers||{};
  var h='<option value="">Private collection</option>';
  groups.forEach(function(g){
    var name=g&&g.name!==undefined?g.name:g;
    h+='<option value="'+collectionRendererEsc(name,helpers)+'" '+(collectionRendererNorm(name,helpers)===collectionRendererNorm(selected,helpers)?'selected':'')+'>'+collectionRendererEsc(name,helpers)+'</option>';
  });
  return h;
}
function collectionScopeTabsHtmlRender(args){
  args=args||{};
  var groups=args.groups||[],scope=args.scope==='groups'?'groups':'mine',filters=args.groupFilters||[],helpers=args.helpers||{};
  var h='<div class="collections-tabs"><button class="'+(scope==='mine'?'on':'')+'" onclick="setCollectionsScope(\'mine\')">My collections</button><button class="'+(scope==='groups'?'on':'')+'" onclick="setCollectionsScope(\'groups\')">My Groups Collections</button></div>';
  if(scope==='groups'){
    h+='<div class="collections-group-filters">';
    if(!groups.length)h+='<span>No groups assigned yet</span>';
    groups.forEach(function(g){
      var on=!filters.length||filters.some(function(v){return collectionRendererNorm(v,helpers)===collectionRendererNorm(g,helpers);});
      h+='<label><input type="checkbox" value="'+collectionRendererEsc(g,helpers)+'" '+(on?'checked':'')+' onchange="toggleCollectionGroupFilter(\''+collectionRendererEsc(g,helpers)+'\',this.checked)"> '+collectionRendererEsc(g,helpers)+'</label>';
    });
    h+='</div>';
  }
  return h;
}
function collectionFiltersHtmlRender(args){
  args=args||{};
  var helpers=args.helpers||{},years=args.years||[],year=args.year||'',advancedOpen=!!args.advancedOpen;
  var mf=Math.min(args.monthFrom||1,args.monthTo||12),mt=Math.max(args.monthFrom||1,args.monthTo||12);
  var months=args.months||['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var companies=args.companies||[],groups=args.groups||[],companyFilter=args.companyFilter||'',groupFilter=args.groupFilter||'';
  var left=((mf-1)/11*100),right=(100-((mt-1)/11*100));
  var h='<div class="collections-filter-panel"><div class="collections-filter-main">';
  h+='<select aria-label="Collection year" onchange="setCollectionYearFilter(this.value)"><option value="">All years</option>';
  years.forEach(function(y){h+='<option value="'+collectionRendererEsc(y,helpers)+'" '+(y===year?'selected':'')+'>'+collectionRendererEsc(y,helpers)+'</option>';});
  h+='</select>';
  h+='<button type="button" class="advanced-filter-toggle" onclick="toggleCollectionAdvancedFilters()" title="'+(advancedOpen?'Hide advanced filters':'Advanced filters')+'" aria-label="'+(advancedOpen?'Hide advanced filters':'Advanced filters')+'"><svg viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h10"/><path d="M18 7h2"/><circle cx="16" cy="7" r="2"/><path d="M4 17h2"/><path d="M10 17h10"/><circle cx="8" cy="17" r="2"/></svg></button></div>';
  if(advancedOpen){
    h+='<div class="collections-advanced-filters">';
    h+='<div class="month-range"><b>'+months[mf-1]+' - '+months[mt-1]+'</b><div class="month-range-track" onclick="setCollectionMonthFromTrack(event)"><span class="month-range-line"></span><span class="month-range-fill" style="left:'+left+'%;right:'+right+'%"></span><input type="range" min="1" max="12" step="1" value="'+mf+'" oninput="setCollectionMonthFilter(this.value,null)"><input type="range" min="1" max="12" step="1" value="'+mt+'" oninput="setCollectionMonthFilter(null,this.value)"></div><div class="month-ticks">'+months.map(function(m){return '<span>'+m+'</span>';}).join('')+'</div></div>';
    h+='<select onchange="setCollectionCompanyFilter(this.value)"><option value="">All brand companies</option>';
    companies.forEach(function(v){h+='<option value="'+collectionRendererEsc(v,helpers)+'" '+(v===companyFilter?'selected':'')+'>'+collectionRendererEsc(v,helpers)+'</option>';});
    h+='</select>';
    h+='<select onchange="setCollectionGroupFilter(this.value)"><option value="">All groups</option>';
    groups.forEach(function(v){h+='<option value="'+collectionRendererEsc(v,helpers)+'" '+(v===groupFilter?'selected':'')+'>'+collectionRendererEsc(v,helpers)+'</option>';});
    h+='</select><button type="button" onclick="clearCollectionAdvancedFilters()">Clear advanced</button></div>';
  }
  h+='</div>';
  return h;
}
function collectionOptionsHtmlRender(args){
  args=args||{};
  var helpers=args.helpers||{},vals=(args.values||[]).slice(),cur=args.current||'';
  if(cur&&vals.indexOf(cur)<0)vals.unshift(cur);
  var h='<option value="">'+(args.label||'No collection')+'</option>';
  vals.forEach(function(v){h+='<option value="'+collectionRendererEsc(v,helpers)+'"'+(v===cur?' selected':'')+'>'+collectionRendererEsc(v,helpers)+'</option>';});
  return h;
}
function collectionStatsHtml(args){
  args=args||{};
  var helpers=args.helpers||{},sum=args.summary||{};
  var fN=helpers.formatNumber||function(v){return String(v||0);};
  var fP=helpers.formatPercent||function(v){return String(v||0);};
  return '<div class="collection-stats"><div class="collection-stat"><span>'+collectionRendererEsc(args.unitsLabel||'Units',helpers)+'</span><b>'+fN(sum.units||0,0)+'</b></div><div class="collection-stat"><span>'+collectionRendererEsc(args.imuLabel||'IMU',helpers)+'</span><b>'+fP(sum.imu||0)+'</b></div></div>';
}
function collectionBoardCardHtml(args){
  args=args||{};
  var helpers=args.helpers||{},meta=args.meta||{},rows=args.rows||[],imgs=args.images||[],sum=args.summary||{},display=args.display||'',creator=args.creator||'';
  var refJson=JSON.stringify(args.ref||'').replace(/"/g,'&quot;');
  var h='<button class="collection-card" onclick="openCollectionBoard('+refJson+')"><div class="collection-collage mosaic-'+Math.min(imgs.length,4)+'">';
  for(var i=0;i<Math.max(1,Math.min(imgs.length,4));i++)h+='<span>'+(imgs[i]?'<img src="'+imgs[i]+'" alt="" loading="lazy" decoding="async">':'')+'</span>';
  var fsd=meta.fsd?' - FSD '+meta.fsd:'',cg=((meta.owner_company||meta.company)?(' - '+(meta.owner_company||meta.company)):'')+((meta.owner_group||meta.group)?(' - '+(meta.owner_group||meta.group)):'');
  h+='</div><b>'+collectionRendererEsc(display,helpers)+'</b><small>'+rows.length+' style'+(rows.length!==1?'s':'')+collectionRendererEsc(fsd+cg,helpers)+'</small>'+(creator?'<small class="collection-creator">Created by '+collectionRendererEsc(creator,helpers)+'</small>':'')+collectionStatsHtml({summary:sum,helpers:helpers,unitsLabel:'Units',imuLabel:'IMU'})+'</button>';
  return h;
}
function collectionDetailHeaderHtml(args){
  args=args||{};
  var helpers=args.helpers||{},sum=args.summary||{},count=args.count||0,fsdText=args.fsdText||'';
  var h='<div class="collections-page-head"><button onclick="backToCollectionsBoard()">&#8592; My collections</button><div><h2>'+collectionRendererEsc(args.folderName||'',helpers)+'</h2><p>'+count+' style'+(count!==1?'s':'')+' in this board'+collectionRendererEsc(fsdText,helpers)+'</p>'+collectionStatsHtml({summary:sum,helpers:helpers,unitsLabel:'Total units',imuLabel:'IMU avg'})+'</div><div class="collection-head-actions">'+(args.supplierCanShare?'<button onclick="shareCurrentCollection()">Share collection</button>':'')+'<button onclick="openEditCollectionModal()">Edit collection</button>'+(args.canRemove?'<button onclick="removeCurrentCollection()" style="background:#fee2e2;color:#b91c1c">Remove</button>':'')+'</div></div>';
  return h;
}
function collectionEmptyStateHtml(kind){
  if(kind==='first')return '<div class="empty-showroom first-collection-empty" style="grid-column:1/-1"><b>Create your first collection</b><span>Organize saved styles by season, group or delivery window.</span><button onclick="openCreateCollectionModal()">Create your first collection</button></div>';
  if(kind==='detail')return '<div class="empty-showroom"><b>This collection is empty</b><span>Add styles from Explore.</span><button onclick="showroomExploreAll()">Go to Explore</button></div>';
  return '<div class="empty-showroom" style="grid-column:1/-1">No collections have an FSD inside this period.</div>';
}
function collectionDetailStyleCardHtml(args){
  args=args||{};
  var helpers=args.helpers||{},r=args.row||{},c=args.calculations||{},img=args.image||'',src=args.sourceLabel||'',sref=args.supplierRef||'',pinH=args.pinHeight||190;
  var statusDot=helpers.statusDot||function(v){return String(v||'');};
  var rowStatus=helpers.rowStatus||function(){return '';};
  var fU=helpers.formatUsd||function(v){return String(v||0);};
  var folderName=args.folderName||'';
  var selected=!!args.selected,loggedIn=!!args.loggedIn;
  var price=(r.fob1||r.fob_closed||c.fob);
  var priceText=(price===null||price===undefined||price==='')?'&#8212;':fU(price);
  var h='<div class="style-card" onclick="openStyleDetail('+r.id+')">'+(loggedIn?'<label class="pin-select" onclick="event.stopPropagation()"><input type="checkbox" class="sh-sel" data-id="'+r.id+'" '+(selected?'checked':'')+' onchange="toggleShowroomSelect('+r.id+',this.checked)" style="cursor:pointer"></label>':'')+'<div class="style-img" style="height:'+pinH+'px">'+(img?'<img src="'+img+'" alt="" loading="lazy" decoding="async">':'<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>')+'</div><div class="style-body"><div class="style-meta">'+statusDot(rowStatus(r))+'<span class="source-pill">'+collectionRendererEsc(src,helpers)+'</span></div><div class="style-ref">'+collectionRendererEsc(r.modelo||'NO STYLE',helpers)+'</div>'+(sref?'<div class="style-supplier-ref">Supplier ref: '+collectionRendererEsc(sref,helpers)+'</div>':'')+'<div class="style-desc">'+collectionRendererEsc(r.desc||'',helpers)+'</div><div class="style-supp">'+collectionRendererEsc(r.supplier||'No supplier',helpers)+'</div><div class="style-foot"><span>'+collectionRendererEsc(folderName,helpers)+'</span>'+(loggedIn?'<b>'+priceText+'</b>':'')+'</div></div></div>';
  return h;
}
var CollectionRenderer={
  adminGroupOptions:collectionAdminGroupOptionsHtml,
  scopeTabs:collectionScopeTabsHtmlRender,
  filters:collectionFiltersHtmlRender,
  collectionOptions:collectionOptionsHtmlRender,
  boardCard:collectionBoardCardHtml,
  detailHeader:collectionDetailHeaderHtml,
  emptyState:collectionEmptyStateHtml,
  detailStyleCard:collectionDetailStyleCardHtml,
  stats:collectionStatsHtml
};
