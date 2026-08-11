function uploadProductPhotoToStorage(path, blob){
  return stdtexSupabaseClient().storage.from('product-photos').upload(path, blob, {contentType:'image/jpeg', upsert:true});
}
function getProductPhotoPublicUrl(path){
  return stdtexSupabaseClient().storage.from('product-photos').getPublicUrl(path);
}
