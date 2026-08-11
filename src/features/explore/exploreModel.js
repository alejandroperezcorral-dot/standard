function exploreNormalizeSearch(value){
  return String(value||'').toLowerCase();
}
function exploreRowField(row,field){
  return (row&&row[field])||'';
}
function exploreMatchesExactFilter(row,field,value){
  return !value||exploreRowField(row,field)===value;
}
function exploreRowSearchText(row,context){
  context=context||{};
  var supplierRef=context.styleSupplierRef||function(){return '';};
  var fabricRef=context.styleFabricRef||function(){return '';};
  var folderName=context.showroomFolderName||function(){return '';};
  var rowStatus=context.rowStatus||function(){return '';};
  var baseNotes=context.baseNotes||function(v){return v||'';};
  return [
    row&&row.modelo,
    supplierRef(row),
    fabricRef(row),
    row&&row.desc,
    row&&row.supplier,
    row&&row.cat,
    row&&row.origin,
    row&&row.colour,
    row&&row.dept,
    row&&row.temporada,
    folderName(row),
    rowStatus(row),
    baseNotes(row&&row.notes)
  ].join(' ').toLowerCase();
}
function exploreMatchesSearch(row,query,context){
  query=exploreNormalizeSearch(query);
  return !query||exploreRowSearchText(row,context).indexOf(query)>=0;
}
