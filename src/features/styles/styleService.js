function normalizeNegotiationRowsAsStyles(rows){
  return (rows||[]).map(styleFromNegotiationRow);
}
