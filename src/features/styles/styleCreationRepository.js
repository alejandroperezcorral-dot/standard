function createStyleCreationRepository(client){
  function requireClient(){
    if(!client)throw new Error('Supabase client is not available');
    return client;
  }
  function maybeSingle(query){
    return query.maybeSingle?query.maybeSingle():query.single();
  }
  return {
    insertStyle:function(row){
      return requireClient().from('styles').insert([row]).select('*').single();
    },
    selectCreatedStyles:function(ownerCompanyId){
      return requireClient().from('styles')
        .select('*')
        .eq('owner_company_id',ownerCompanyId)
        .order('created_at',{ascending:false});
    },
    archiveStyle:function(styleId){
      return requireClient().from('styles')
        .update({lifecycle_state:'ARCHIVED',archived_at:new Date().toISOString(),updated_at:new Date().toISOString()})
        .eq('id',styleId)
        .select('*')
        .single();
    },
    linkNegotiationRow:function(rowId,styleId){
      return requireClient().from('negotiation_rows').update({style_id:styleId}).eq('id',rowId);
    },
    selectBrandStyleContext:function(brandCompanyId,styleId){
      return maybeSingle(requireClient().from('brand_style_contexts')
        .select('*')
        .eq('brand_company_id',brandCompanyId)
        .eq('style_id',styleId));
    },
    insertBrandStyleContext:function(row){
      return requireClient().from('brand_style_contexts').insert([row]).select('*').single();
    },
    updateBrandStyleContext:function(id,row){
      return requireClient().from('brand_style_contexts').update(row).eq('id',id).select('*').single();
    },
    selectDepartments:function(companyId,includeInactive){
      var q=requireClient().from('company_departments').select('*').eq('company_id',companyId).order('name',{ascending:true});
      if(!includeInactive)q=q.eq('active',true);
      return q;
    },
    insertDepartment:function(row){
      return requireClient().from('company_departments').insert([row]).select('*').single();
    },
    updateDepartment:function(id,row){
      return requireClient().from('company_departments').update(row).eq('id',id).select('*').single();
    },
    selectCategories:function(companyId,departmentId,includeInactive){
      var q=requireClient().from('company_categories').select('*').eq('company_id',companyId).order('name',{ascending:true});
      if(departmentId)q=q.eq('department_id',departmentId);
      if(!includeInactive)q=q.eq('active',true);
      return q;
    },
    insertCategory:function(row){
      return requireClient().from('company_categories').insert([row]).select('*').single();
    },
    updateCategory:function(id,row){
      return requireClient().from('company_categories').update(row).eq('id',id).select('*').single();
    }
  };
}
