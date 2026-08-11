function hasPlatformAdminAccess(profile,userEmail,adminEmail){
  return !!(profile&&(profile.role==='admin'||profile.access_role==='Platform Admin'))||String(userEmail||'')===String(adminEmail||'');
}
function isPlatformAdminProfileData(profile,adminEmail){
  return !!(profile&&(profile.role==='admin'||profile.access_role==='Platform Admin'||profile.email===adminEmail));
}
function isSupplierProfileData(profile){
  return !!(profile&&(profile.role==='supplier'||profile.company_type==='Supplier'));
}
function profileAccessRole(profile,isAdminUser,adminViewActive){
  if(adminViewActive)return (profile&&(profile.access_role||profile.company_access_role))||'Company Member';
  return (profile&&(profile.access_role||profile.company_access_role))||(isAdminUser?'Platform Admin':'Company Member');
}
function isCompanyAdminRole(role,profile,isAdminUser){
  return !!(isAdminUser||/platform admin|company admin/i.test(String(role||''))||(profile&&(profile.company_admin||profile.is_company_admin)));
}
function canUseBuyingListForRole(isSupplierUser,isAdminUser){
  return !isSupplierUser||isAdminUser;
}
function canDeleteStyleForUser(isAdminUser,userId,rowUserId){
  return !!(isAdminUser||(userId&&rowUserId&&rowUserId===userId));
}
function permissionNormCompanyName(value){
  return String(value||'').trim().toLowerCase();
}
function canManageCompanyCollectionsFor(isAdminUser,isCompanyAdminUser,company,activeCompany,type,activeType){
  return !!(isAdminUser||(isCompanyAdminUser&&permissionNormCompanyName(company)===permissionNormCompanyName(activeCompany)&&(!type||String(type)===activeType)));
}
