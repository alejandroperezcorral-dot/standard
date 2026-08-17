var STYLE_NEGOTIATION_ROW_COLUMNS='id,style_id,fecha,modelo,colour,description,supplier,origin,transport,temporada,dept,cat,pvp_rub,fob1,fob2,fob3,fob_closed,weight,units,target_imu,notes,status,fsd,hod,ch_off,ch_mkt,ch_onl,sell_thru,lc_weeks,photo,photo2,cust_profile,capsule,fashionability,n_colours,user_id,folder_id';

function selectNegotiationRowsForStyles(client){
  return client.from('negotiation_rows').select(STYLE_NEGOTIATION_ROW_COLUMNS).order('id',{ascending:true});
}
