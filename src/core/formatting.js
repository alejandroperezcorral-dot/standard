function fN(x,d){return x==null?'\u2014':Number(x).toLocaleString('en',{minimumFractionDigits:d||0,maximumFractionDigits:d||0});}
function fU(x){return '$'+fN(x,2);}
function fP(x){return isFinite(x)?(x*100).toFixed(1)+'%':'\u2014';}
