function styleCreationNormText(value){
  return String(value||'').trim();
}

function styleCreationProfileCompany(profile){
  profile=profile||{};
  return {
    id:profile.company_id||profile.active_company_id||profile.owner_company_id||null,
    name:styleCreationNormText(profile.active_company_name||profile.company_name||profile.supplier_company||''),
    type:normalizeStyleCreatedByType(profile.company_type||profile.role||profile.user_type||'BRAND')
  };
}

function styleCreationCanManageTaxonomy(profile,companyId){
  profile=profile||{};
  var role=String(profile.access_role||profile.company_access_role||profile.role||'').toLowerCase();
  if(role==='admin'||role==='platform admin')return true;
  if(role!=='company admin')return false;
  if(!companyId)return true;
  return styleCreationId(profile.company_id||profile.active_company_id||'')===styleCreationId(companyId);
}

function createCanonicalStylePayload(input,context){
  input=input||{};context=context||{};
  var company=styleCreationProfileCompany(context.profile||{});
  var user=context.user||{};
  var createdByType=normalizeStyleCreatedByType(context.createdByType||company.type);
  var now=context.now||new Date().toISOString();
  var attrs={
    color:styleCreationNormText(input.color||input.colour),
    origin:styleCreationNormText(input.origin),
    season:styleCreationNormText(input.season||input.temporada),
    supplier:styleCreationNormText(input.supplier),
    main_image:styleCreationNormText(input.mainImage||input.photo||input.photo1),
    secondary_image:styleCreationNormText(input.secondaryImage||input.photo2),
    units:input.units||input.moq||null
  };
  return {
    created_by:user.id||null,
    created_by_email:user.email||'',
    created_by_type:createdByType,
    owner_company_id:company.id,
    owner_company_name:company.name,
    creator_company_id:company.id,
    creator_company_name:company.name,
    lifecycle_state:STYLE_LIFECYCLE_STATES.ACTIVE,
    publication_state:STYLE_PUBLICATION_STATES.PRIVATE,
    supplier_reference:styleCreationNormText(input.supplierReference||input.supplier_reference),
    fabric_reference:styleCreationNormText(input.fabricReference||input.fabric_reference),
    style_ref:styleCreationNormText(input.styleRef||input.style_reference||input.modelo),
    title:styleCreationNormText(input.title||input.name||input.description||input.desc),
    description:styleCreationNormText(input.description||input.desc),
    master_attributes:attrs,
    images:[attrs.main_image,attrs.secondary_image].filter(Boolean).map(function(url,idx){return {url:url,main:idx===0};}),
    created_at:now,
    updated_at:now
  };
}

function canonicalPayloadToLegacyNegotiationRow(style,input,context){
  input=input||{};context=context||{};style=style||{};
  var attrs=style.master_attributes||{};
  return {
    id:input.id||null,
    fecha:(context.today||new Date().toISOString().slice(0,10)),
    modelo:style.style_ref||input.styleRef||input.modelo||'',
    colour:attrs.color||input.colour||'',
    description:style.description||style.title||input.description||input.desc||'',
    supplier:attrs.supplier||input.supplier||'',
    origin:attrs.origin||input.origin||'',
    transport:input.transport||'',
    temporada:attrs.season||input.season||input.temporada||'',
    dept:input.department||input.dept||'',
    cat:input.category||input.cat||'',
    pvp_rub:input.pvp_rub||null,
    fob1:input.fob||input.fob1||null,
    fob2:null,
    fob3:null,
    fob_closed:null,
    weight:input.weight||null,
    units:attrs.units||input.units||input.moq||null,
    target_imu:input.target_imu||0.72,
    notes:input.notes||('[SOURCE:'+normalizeStyleCreatedByType(style.created_by_type)+'] '+(style.description||'')),
    status:input.status||'PENDING',
    fsd:input.fsd||null,
    photo:attrs.main_image||null,
    photo2:attrs.secondary_image||null,
    capsule:input.collection||input.capsule||'',
    source:normalizeStyleCreatedByType(style.created_by_type),
    user_id:style.created_by_user_id||style.created_by||null,
    folder_id:null,
    style_id:style.id||style.style_id||null,
    updated_at:new Date().toISOString()
  };
}

async function createStyleService(input,context){
  context=context||{};
  var repo=context.repository;
  if(!repo)throw new Error('Style repository is not available');
  var payload=createCanonicalStylePayload(input,context);
  if(!payload.owner_company_id&&!payload.owner_company_name)throw new Error('Company context is required to create a style.');
  var result=await repo.insertStyle(payload);
  if(result.error)throw result.error;
  return result.data;
}

async function getCreatedStylesService(context){
  context=context||{};
  var repo=context.repository,company=styleCreationProfileCompany(context.profile||{});
  if(!repo)throw new Error('Style repository is not available');
  if(!company.id)return {data:[],error:null};
  return repo.selectCreatedStyles(company.id);
}

async function getOrCreateBrandStyleContextService(input,context){
  context=context||{};input=input||{};
  var repo=context.repository;
  if(!repo)throw new Error('Style repository is not available');
  var brandCompanyId=input.brandCompanyId||input.brand_company_id||styleCreationProfileCompany(context.profile||{}).id;
  var styleId=input.styleId||input.style_id;
  var existing=await repo.selectBrandStyleContext(brandCompanyId,styleId);
  if(existing.error)throw existing.error;
  if(existing.data)return existing.data;
  var row=createBrandStyleContextModel(Object.assign({},input,{brand_company_id:brandCompanyId,style_id:styleId}));
  row.created_by=(context.user&&context.user.id)||null;
  var inserted=await repo.insertBrandStyleContext(row);
  if(inserted.error)throw inserted.error;
  return inserted.data;
}

async function assignBrandTaxonomyService(input,context){
  context=context||{};input=input||{};
  var repo=context.repository;
  if(!repo)throw new Error('Style repository is not available');
  var ctx=await getOrCreateBrandStyleContextService(input,context);
  var patch={
    department_id:input.departmentId||input.department_id||ctx.department_id||null,
    category_id:input.categoryId||input.category_id||ctx.category_id||null,
    updated_at:new Date().toISOString()
  };
  var updated=await repo.updateBrandStyleContext(ctx.id,patch);
  if(updated.error)throw updated.error;
  return updated.data;
}

var StyleCreationService={
  profileCompany:styleCreationProfileCompany,
  canManageTaxonomy:styleCreationCanManageTaxonomy,
  createCanonicalPayload:createCanonicalStylePayload,
  canonicalPayloadToLegacyNegotiationRow:canonicalPayloadToLegacyNegotiationRow,
  createStyle:createStyleService,
  getCreatedStyles:getCreatedStylesService,
  getOrCreateBrandStyleContext:getOrCreateBrandStyleContextService,
  assignBrandTaxonomy:assignBrandTaxonomyService
};
