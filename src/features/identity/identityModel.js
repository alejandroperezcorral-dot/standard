function identityEffectiveProfile(currentProfile, adminViewProfile){
  return adminViewProfile||currentProfile||{};
}
function identityEffectiveUserId(authUser, adminViewUid){
  return adminViewUid||(authUser&&authUser.id)||'';
}
function identityEffectiveUserEmail(authUser, adminViewEmail){
  return adminViewEmail||(authUser&&authUser.email)||'';
}
function identityIsPlatformAdminProfile(profile, adminEmail){
  return !!(profile&&(profile.role==='admin'||profile.access_role==='Platform Admin'||profile.email===adminEmail));
}
function identityIsSupplierProfile(profile){
  return !!(profile&&(profile.role==='supplier'||profile.company_type==='Supplier'));
}
function identityIsBrandProfile(profile){
  return !identityIsSupplierProfile(profile);
}
function identitySupplierCompany(profile){
  var p=profile||{};
  return (p&&(p.active_company_name||p.company_name||p.supplier_company||p.supplier||p.company))||'';
}
function identityCompanyAccessRole(profile,isAdminUser,adminViewActive){
  if(adminViewActive)return (profile&&(profile.access_role||profile.company_access_role))||'Company Member';
  return (profile&&(profile.access_role||profile.company_access_role))||(isAdminUser?'Platform Admin':'Company Member');
}
function identityActiveCompanyName(profile,adminViewActive,adminEmail){
  var p=profile||{};
  if(identityIsPlatformAdminProfile(p,adminEmail)&&!adminViewActive)return '';
  return (p&&(p.active_company_name||p.company_name||p.supplier_company||p.company))||'';
}
function identityActiveCompanyType(profile,isAdminUser,isSupplierUser,adminViewActive,adminEmail){
  var p=profile||{};
  if(identityIsPlatformAdminProfile(p,adminEmail)&&!adminViewActive)return '';
  if(p&&p.company_type)return p.company_type;
  if(isAdminUser)return 'Brand';
  return isSupplierUser?'Supplier':'Brand';
}
function identityProfileCompanyGroup(profile){
  var p=profile||{};
  return (p&&(p.company_group||p.group||p.company_subgroup||p.department))||'';
}
function identityNorm(value){
  return String(value||'').trim().toLowerCase();
}
function identityGroupList(profile, authGroupNames){
  var vals=[];
  function add(value){
    String(value||'').split(',').forEach(function(part){
      part=part.trim();
      if(part&&!vals.some(function(existing){return identityNorm(existing)===identityNorm(part);}))vals.push(part);
    });
  }
  add(identityProfileCompanyGroup(profile));
  (authGroupNames||[]).forEach(add);
  var p=profile||{};
  if(p){add(p.company_groups);add(p.groups);}
  return vals;
}
