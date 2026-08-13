var OrganizationService=(function(){
  function requireClient(client){
    if(!client)throw new Error('Supabase client is not available');
    return client;
  }

  async function acceptInvitation(client, token){
    token=String(token||'').trim();
    if(!token)throw new Error('Invite link is not available.');
    return requireClient(client).rpc('accept_company_invitation',{invitation_token:token});
  }

  async function createInvitation(client, input){
    input=input||{};
    return requireClient(client).rpc('create_company_invitation',{
      p_email:String(input.email||'').trim().toLowerCase(),
      p_access_role:input.accessRole||'Company Member',
      p_first_name:input.firstName||'',
      p_last_name:input.lastName||'',
      p_job_position:input.jobPosition||'',
      p_department:input.department||'',
      p_group_ids:input.groupIds||[],
      p_expires_at:input.expiresAt||null
    });
  }

  async function revokeInvitation(client, invitationId){
    if(!invitationId)throw new Error('Invitation not found.');
    return requireClient(client).rpc('revoke_company_invitation',{p_invitation_id:invitationId});
  }

  async function updateMember(client, input){
    input=input||{};
    if(!input.memberUserId)throw new Error('Member not found.');
    return requireClient(client).rpc('update_company_member',{
      p_member_user_id:input.memberUserId,
      p_access_role:input.accessRole||'Company Member',
      p_group_ids:input.groupIds||[],
      p_job_position:input.jobPosition||'',
      p_department:input.department||''
    });
  }

  async function removeMember(client, memberUserId){
    if(!memberUserId)throw new Error('Member not found.');
    return requireClient(client).rpc('remove_company_member',{p_member_user_id:memberUserId});
  }

  async function updateOwnProfile(client, input){
    input=input||{};
    return requireClient(client).rpc('update_own_profile',{
      p_first_name:input.firstName||'',
      p_last_name:input.lastName||'',
      p_phone:input.phone||'',
      p_job_position:input.jobPosition||''
    });
  }

  return {
    acceptInvitation:acceptInvitation,
    createInvitation:createInvitation,
    revokeInvitation:revokeInvitation,
    updateMember:updateMember,
    removeMember:removeMember,
    updateOwnProfile:updateOwnProfile
  };
})();
