function companyKeyFromName(name){
  return String(name||'').trim().toLowerCase().replace(/\s+/g,'-')||'company';
}
function normalizeCompanyTypeValue(value, fallback){
  value=String(value||fallback||'Brand').trim();
  return value==='Supplier'?'Supplier':'Brand';
}
function companyTypeBadgeHtml(type, escapeHtml){
  return '<span class="platform-badge '+(type==='Supplier'?'supplier':'brand')+'">'+escapeHtml(type||'Brand')+'</span>';
}
function companyStatusBadgeHtml(status, escapeHtml){
  var key=String(status||'Active').toLowerCase().split(' ')[0];
  return '<span class="platform-badge '+(key==='pending'?'pending':key==='active'?'active':'')+'">'+escapeHtml(status||'Active')+'</span>';
}
function normalizeCompanyRecordModel(company){
  var c=company||{};
  return {
    id:c.id||companyKeyFromName(c.name),name:c.name||'',type:c.type||'Brand',logo:c.logo||'',
    description:c.description||'',country:c.country||'',city:c.city||'',website:c.website||'',
    mainEmail:c.mainEmail||c.main_email||'',mainPhone:c.mainPhone||c.main_phone||'',address:c.address||'',
    status:c.status||'Active',createdBy:c.createdBy||c.created_by||'',createdAt:c.createdAt||c.created_at||'',
    updatedAt:c.updatedAt||c.updated_at||'',admins:c.admins||[],members:c.members||[],products:c.products||0,
    collections:c.collections||0,activeNegotiations:c.activeNegotiations||0,closedNegotiations:c.closedNegotiations||0,
    lastActivity:c.lastActivity||''
  };
}
function profileCompanyValueModel(profile, isPlatformAdmin){
  if(isPlatformAdmin)return '';
  return (profile&&(profile.active_company_name||profile.company_name||profile.supplier_company||profile.supplier||profile.company))||'';
}
function profileCompanyTypeValueModel(profile, isPlatformAdmin){
  if(isPlatformAdmin)return '';
  return (profile&&profile.company_type)||(profile&&profile.role==='supplier'?'Supplier':'Brand');
}
function companyAccessRoleValueModel(profile, isPlatformAdmin){
  if(isPlatformAdmin)return 'Platform Admin';
  return (profile&&(profile.access_role||profile.company_access_role))||'Company Member';
}
function inferredCompanyFromEmailValue(email){
  email=String(email||'').toLowerCase().trim();
  var domain=(email.split('@')[1]||'').split(':')[0];
  if(!domain)return '';
  var root=domain.split('.')[0]||'';
  var common={gmail:1,icloud:1,hotmail:1,outlook:1,yahoo:1,yandex:1,mail:1,proton:1,aol:1,live:1,msn:1};
  if(!root||common[root])return '';
  return root.split(/[-_]+/).filter(Boolean).map(function(part){return part.charAt(0).toUpperCase()+part.slice(1);}).join(' ');
}
