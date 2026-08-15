var STYLE_CREATED_BY_TYPES={
  SUPPLIER:'SUPPLIER',
  BRAND:'BRAND'
};

var STYLE_LIFECYCLE_STATES={
  ACTIVE:'ACTIVE',
  ARCHIVED:'ARCHIVED'
};

var STYLE_PUBLICATION_STATES={
  PRIVATE:'PRIVATE',
  SHARED:'SHARED',
  PUBLISHED:'PUBLISHED',
  ARCHIVED:'ARCHIVED'
};

var MY_STYLES_TABS={
  CREATED:'CREATED',
  SHARED_WITH_US:'SHARED_WITH_US',
  ARCHIVED:'ARCHIVED'
};

function normalizeStyleCreatedByType(value){
  value=String(value||'').trim().toUpperCase();
  if(value==='SUPPLIER'||value==='SUPPLIER_STYLE'||value==='SHOWROOM')return STYLE_CREATED_BY_TYPES.SUPPLIER;
  if(value==='BRAND'||value==='BUYER'||value==='DESIGN'||value==='BRAND_STYLE')return STYLE_CREATED_BY_TYPES.BRAND;
  return STYLE_CREATED_BY_TYPES.BRAND;
}

function styleCreationId(value){
  if(value===0)return '0';
  return value==null?'':String(value);
}

function styleCreationListContains(values,value){
  value=styleCreationId(value);
  return (values||[]).some(function(item){return styleCreationId(item)===value;});
}

function styleCreationMainImage(row){
  if(!row)return '';
  return row.main_image||row.photo||row.photo1||row.image||'';
}

function inferCreatedByTypeFromRow(row,context){
  context=context||{};
  if(context.createdByType)return normalizeStyleCreatedByType(context.createdByType);
  if(row&&isSupplierShowroomStyle&&isSupplierShowroomStyle(row))return STYLE_CREATED_BY_TYPES.SUPPLIER;
  return normalizeStyleCreatedByType(row&&(row.created_by_type||row.product_source||row.source));
}

function canonicalStyleFromNegotiationRow(row,context){
  row=row||{};
  context=context||{};
  var createdByType=inferCreatedByTypeFromRow(row,context);
  var supplierName=row.supplier||context.supplierCompanyName||'';
  var ownerCompanyId=context.ownerCompanyId||context.owner_company_id||null;
  var ownerCompanyName=context.ownerCompanyName||context.owner_company_name||'';
  if(!ownerCompanyName){
    ownerCompanyName=createdByType===STYLE_CREATED_BY_TYPES.SUPPLIER?supplierName:(context.activeCompanyName||context.companyName||'');
  }
  return {
    style_id:styleCreationId(row.id),
    legacy_negotiation_row_id:row.id==null?null:row.id,
    created_by:row.user_id||context.createdBy||context.created_by||null,
    created_by_email:context.createdByEmail||context.created_by_email||'',
    created_by_type:createdByType,
    owner_company_id:ownerCompanyId,
    owner_company_name:ownerCompanyName,
    creator_company_id:context.creatorCompanyId||context.creator_company_id||ownerCompanyId,
    creator_company_name:context.creatorCompanyName||context.creator_company_name||ownerCompanyName,
    source:'LEGACY_NEGOTIATION_ROWS',
    lifecycle_state:context.archived?STYLE_LIFECYCLE_STATES.ARCHIVED:STYLE_LIFECYCLE_STATES.ACTIVE,
    publication_state:context.publicationState||STYLE_PUBLICATION_STATES.PRIVATE,
    master_attributes:{
      style_ref:row.modelo||'',
      description:row.description||row.desc||'',
      supplier_reference:styleSupplierReference?styleSupplierReference(row):(row.supplier_ref||''),
      fabric_reference:styleFabricReference?styleFabricReference(row):(row.fabric_ref||''),
      origin:row.origin||'',
      supplier:supplierName,
      season:row.temporada||row.season||'',
      color:row.colour||row.color||'',
      main_image:styleCreationMainImage(row),
      secondary_image:row.photo2||'',
      fsd:row.fsd||'',
      fob:row.fob_closed||row.fob1||row.fob||'',
      units:row.units||''
    }
  };
}

function canonicalStyleCreatedByCompany(style,companyId){
  if(!style||!companyId)return false;
  return styleCreationId(style.owner_company_id)===styleCreationId(companyId);
}

function canonicalStyleArchived(style){
  return !!style&&style.lifecycle_state===STYLE_LIFECYCLE_STATES.ARCHIVED;
}

function myStylesTabForCanonicalStyle(style,companyId,shares){
  if(canonicalStyleArchived(style))return MY_STYLES_TABS.ARCHIVED;
  if(canonicalStyleCreatedByCompany(style,companyId))return MY_STYLES_TABS.CREATED;
  if(styleCreationListContains(shares&&shares.sharedWithCompanyIds,companyId))return MY_STYLES_TABS.SHARED_WITH_US;
  return '';
}

function supplierStyleCanPublishToExplore(style,publication){
  publication=publication||{};
  return !!style&&
    style.created_by_type===STYLE_CREATED_BY_TYPES.SUPPLIER&&
    !canonicalStyleArchived(style)&&
    publication.visibility_state===STYLE_PUBLICATION_STATES.PUBLISHED;
}

function createBrandStyleContextModel(input){
  input=input||{};
  return {
    brand_company_id:input.brand_company_id||input.brandCompanyId||null,
    style_id:styleCreationId(input.style_id||input.styleId),
    department_id:input.department_id||input.departmentId||null,
    category_id:input.category_id||input.categoryId||null,
    target_price:input.target_price||input.targetPrice||null,
    target_currency:input.target_currency||input.targetCurrency||'USD',
    internal_status:input.internal_status||input.internalStatus||'PENDING',
    costing_model_id:input.costing_model_id||input.costingModelId||null,
    costing_config_version_id:input.costing_config_version_id||input.costingConfigVersionId||null,
    costing_resolved_at:input.costing_resolved_at||input.costingResolvedAt||null
  };
}

function validateBrandStyleContextModel(context){
  context=context||{};
  var missing=[];
  if(!context.brand_company_id)missing.push('brand_company_id');
  if(!context.style_id)missing.push('style_id');
  if(!context.department_id)missing.push('department_id');
  if(!context.category_id)missing.push('category_id');
  return {ok:missing.length===0,missing:missing};
}

function brandCanSeeBrandStyleContextModel(brandCompanyId,context){
  if(!brandCompanyId||!context)return false;
  return styleCreationId(brandCompanyId)===styleCreationId(context.brand_company_id);
}

function createStyleRfqModel(input){
  input=input||{};
  return {
    rfq_id:input.rfq_id||input.rfqId||null,
    brand_company_id:input.brand_company_id||input.brandCompanyId||null,
    style_id:styleCreationId(input.style_id||input.styleId),
    supplier_company_ids:(input.supplier_company_ids||input.supplierCompanyIds||[]).map(styleCreationId),
    status:input.status||'OPEN'
  };
}

function createStyleQuotationModel(input){
  input=input||{};
  return {
    quotation_id:input.quotation_id||input.quotationId||null,
    rfq_id:input.rfq_id||input.rfqId||null,
    style_id:styleCreationId(input.style_id||input.styleId),
    supplier_company_id:input.supplier_company_id||input.supplierCompanyId||null,
    fob:input.fob||null,
    units:input.units||null,
    status:input.status||'SUBMITTED'
  };
}

function confirmedOutcomeClosesCanonicalStyleModel(){
  return false;
}
