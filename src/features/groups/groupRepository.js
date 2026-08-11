function fetchCompanyGroupNamesForUser(client,companyId,userId){
  return client.from('company_group_memberships')
    .select('company_groups(name)')
    .eq('user_id',userId)
    .eq('company_id',companyId);
}
