function fetchActiveCompanyMembership(client,userId){
  return client.from('company_memberships')
    .select('access_role,job_position,membership_status,companies(id,name,type,logo,description,country,city,website,main_email,main_phone,address,status,created_at,updated_at)')
    .eq('user_id',userId)
    .eq('membership_status','Active')
    .maybeSingle();
}
