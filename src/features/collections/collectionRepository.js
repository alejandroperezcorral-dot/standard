function createCollectionRepository(supabase){
  return {
    findScopedCollection:function(scope,name){
      return supabase.from('showroom_collections_scoped')
        .select('id,created_by')
        .eq('owner_company',scope.owner_company)
        .eq('owner_group',scope.owner_group||'')
        .eq('owner_type',scope.owner_type)
        .eq('name',name)
        .maybeSingle();
    },
    updateScopedCollectionById:function(id,row){
      return supabase.from('showroom_collections_scoped').update(row).eq('id',id);
    },
    insertScopedCollection:function(row){
      return supabase.from('showroom_collections_scoped').insert(row);
    },
    deleteStyleAssignment:function(scope,rowId,collectionName){
      return supabase.from('style_collection_assignments')
        .delete()
        .eq('row_id',rowId)
        .eq('owner_company',scope.owner_company)
        .eq('owner_group',scope.owner_group||'')
        .eq('owner_type',scope.owner_type)
        .eq('collection_name',collectionName);
    },
    upsertStyleAssignment:function(row){
      return supabase.from('style_collection_assignments')
        .upsert(row,{onConflict:'row_id,owner_company,owner_group,owner_type,collection_name'});
    },
    deleteOtherStyleAssignments:function(scope,rowId,collectionName){
      return supabase.from('style_collection_assignments')
        .delete()
        .eq('row_id',rowId)
        .eq('owner_company',scope.owner_company)
        .eq('owner_group',scope.owner_group||'')
        .eq('owner_type',scope.owner_type)
        .neq('collection_name',collectionName);
    }
  };
}
