function splitCompanyGroupNames(value){
  if(Array.isArray(value))return value.map(function(name){return String(name||'').trim();}).filter(Boolean);
  return String(value||'').split(',').map(function(name){return name.trim();}).filter(Boolean);
}
function uniqueCompanyGroupNames(values, normalizeName){
  var out=[];
  (values||[]).forEach(function(value){
    splitCompanyGroupNames(value).forEach(function(name){
      if(name&&!out.some(function(existing){return normalizeName(existing)===normalizeName(name);}))out.push(name);
    });
  });
  return out;
}
function companyGroupNamesForMember(member, groups, normalizeName){
  var id=member&&(member.id||member.email),email=member&&member.email,out=[];
  (groups||[]).forEach(function(group){
    var members=group.members||[];
    if(members.indexOf(id)>=0||(email&&members.indexOf(email)>=0))out.push(group.name);
  });
  return uniqueCompanyGroupNames(out.concat(member&&member.group?[member.group]:[]), normalizeName);
}
