function normalizeRoutePath(pathname){
  var p=String(pathname||'/').toLowerCase().replace(/\/+$/,'');
  return (!p||p==='/index.html')?'/explore':p;
}
function routePathForPage(name,state){
  state=state||{};
  if(name==='showroom')return state.collectionsView?'/collections':'/explore';
  if(name==='company')return '/mycompany';
  if(name==='neg')return '/negotiation';
  if(name==='closed')return '/closed';
  if(name==='suppliers')return '/suppliers';
  if(name==='chat')return '/chat';
  if(name==='canvas')return state.canvasId?'/canvas/'+encodeURIComponent(state.canvasId):'/canvas';
  if(name==='admin')return '/admin';
  return '';
}
