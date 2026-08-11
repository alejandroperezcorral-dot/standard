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
    },
    deleteScopedCollection:function(scope,name){
      return supabase.from('showroom_collections_scoped')
        .delete()
        .eq('owner_company',scope.owner_company)
        .eq('owner_group',scope.owner_group||'')
        .eq('owner_type',scope.owner_type)
        .eq('name',name);
    },
    updateStyleAssignmentsCollectionName:function(scope,oldName,newName){
      return supabase.from('style_collection_assignments')
        .update({collection_name:newName})
        .eq('owner_company',scope.owner_company)
        .eq('owner_group',scope.owner_group||'')
        .eq('owner_type',scope.owner_type)
        .eq('collection_name',oldName);
    },
    updateScopedCollectionExplicit:function(filters,row){
      return supabase.from('showroom_collections_scoped')
        .update(row)
        .eq('owner_company',filters.owner_company)
        .eq('owner_group',filters.owner_group||'')
        .eq('owner_type',filters.owner_type)
        .eq('name',filters.name);
    },
    updateAssignmentsForCollection:function(filters,row){
      return supabase.from('style_collection_assignments')
        .update(row)
        .eq('owner_company',filters.owner_company)
        .eq('owner_group',filters.owner_group||'')
        .eq('owner_type',filters.owner_type)
        .eq('collection_name',filters.collection_name);
    },
    deleteStyleAssignmentsForCollection:function(filters){
      return supabase.from('style_collection_assignments')
        .delete()
        .eq('owner_company',filters.owner_company)
        .eq('owner_group',filters.owner_group||'')
        .eq('owner_type',filters.owner_type)
        .eq('collection_name',filters.collection_name);
    },
    deleteScopedCollectionById:function(id){
      return supabase.from('showroom_collections_scoped').delete().eq('id',id);
    },
    deleteScopedCollectionByFilters:function(filters){
      return supabase.from('showroom_collections_scoped')
        .delete()
        .eq('owner_company',filters.owner_company)
        .eq('owner_group',filters.owner_group||'')
        .eq('owner_type',filters.owner_type)
        .eq('name',filters.name);
    },
    selectScopedCollectionById:function(id){
      return supabase.from('showroom_collections_scoped').select('id').eq('id',id);
    },
    selectScopedCollectionByFilters:function(filters){
      return supabase.from('showroom_collections_scoped')
        .select('id')
        .eq('owner_company',filters.owner_company)
        .eq('owner_group',filters.owner_group||'')
        .eq('owner_type',filters.owner_type)
        .eq('name',filters.name);
    }
  };
}
