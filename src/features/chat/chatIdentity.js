var CANONICAL_CHAT_ERROR_CODES={
  SUPPLIER_LOCKED:'SUPPLIER_LOCKED',
  UNAUTHORIZED:'UNAUTHORIZED',
  STYLE_NOT_AVAILABLE:'STYLE_NOT_AVAILABLE',
  GROUP_NOT_ALLOWED:'GROUP_NOT_ALLOWED',
  CONVERSATION_NOT_FOUND:'CONVERSATION_NOT_FOUND',
  SEND_DENIED:'SEND_DENIED',
  INVALID_CONTEXT:'INVALID_CONTEXT'
};

function chatIdentityValue(value){
  if(value===0)return '0';
  return value==null?'':String(value);
}

function chatIdentityUuidLike(value){
  value=chatIdentityValue(value).trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function normalizeCanonicalChatContext(input){
  input=input||{};
  return {
    conversationId:chatIdentityValue(input.conversationId||input.conversation_id||input.id||''),
    styleId:chatIdentityValue(input.styleId||input.style_id||''),
    brandStyleContextId:chatIdentityValue(input.brandStyleContextId||input.brand_style_context_id||''),
    supplierCompanyId:chatIdentityValue(input.supplierCompanyId||input.supplier_company_id||''),
    brandCompanyId:chatIdentityValue(input.brandCompanyId||input.brand_company_id||''),
    brandCompanyGroupId:chatIdentityValue(input.brandCompanyGroupId||input.brand_company_group_id||input.groupId||input.group_id||''),
    legacyRowId:input.legacyRowId==null&&input.legacy_row_id==null?null:chatIdentityValue(input.legacyRowId||input.legacy_row_id)
  };
}

function assertStyleChatIdentity(context){
  context=normalizeCanonicalChatContext(context);
  if(!context.styleId)return {ok:false,code:CANONICAL_CHAT_ERROR_CODES.STYLE_NOT_AVAILABLE,message:'styleId is required for canonical Style Chat'};
  if(!chatIdentityUuidLike(context.styleId))return {ok:false,code:CANONICAL_CHAT_ERROR_CODES.STYLE_NOT_AVAILABLE,message:'styleId must be a canonical UUID'};
  if(context.legacyRowId&&context.styleId===context.legacyRowId)return {ok:false,code:CANONICAL_CHAT_ERROR_CODES.STYLE_NOT_AVAILABLE,message:'legacyRowId must not be used as canonical styleId'};
  if(!context.brandCompanyGroupId)return {ok:false,code:CANONICAL_CHAT_ERROR_CODES.GROUP_NOT_ALLOWED,message:'brandCompanyGroupId is required'};
  return {ok:true,context:context};
}

function assertSupplierChatIdentity(context){
  context=normalizeCanonicalChatContext(context);
  if(!context.supplierCompanyId)return {ok:false,code:CANONICAL_CHAT_ERROR_CODES.STYLE_NOT_AVAILABLE,message:'supplierCompanyId is required'};
  if(!chatIdentityUuidLike(context.supplierCompanyId))return {ok:false,code:CANONICAL_CHAT_ERROR_CODES.STYLE_NOT_AVAILABLE,message:'supplierCompanyId must be a canonical UUID'};
  if(!context.brandCompanyGroupId)return {ok:false,code:CANONICAL_CHAT_ERROR_CODES.GROUP_NOT_ALLOWED,message:'brandCompanyGroupId is required'};
  return {ok:true,context:context};
}

function normalizeChatError(error){
  var message=chatIdentityValue(error&&error.message||error&&error.error_description||error&&error.details||error);
  var lower=message.toLowerCase();
  var code=CANONICAL_CHAT_ERROR_CODES.UNAUTHORIZED;
  if(/supplier.*(locked|unlock|not unlocked)/.test(lower))code=CANONICAL_CHAT_ERROR_CODES.SUPPLIER_LOCKED;
  else if(/style.*(not available|supplier style|required)/.test(lower))code=CANONICAL_CHAT_ERROR_CODES.STYLE_NOT_AVAILABLE;
  else if(/group/.test(lower))code=CANONICAL_CHAT_ERROR_CODES.GROUP_NOT_ALLOWED;
  else if(/conversation.*(not found|does not exist)/.test(lower))code=CANONICAL_CHAT_ERROR_CODES.CONVERSATION_NOT_FOUND;
  else if(/send|sender|insert|write/.test(lower))code=CANONICAL_CHAT_ERROR_CODES.SEND_DENIED;
  return {ok:false,code:code,message:message||code,raw:error||null};
}

var ChatIdentity={
  errorCodes:CANONICAL_CHAT_ERROR_CODES,
  value:chatIdentityValue,
  uuidLike:chatIdentityUuidLike,
  normalizeContext:normalizeCanonicalChatContext,
  assertStyleChat:assertStyleChatIdentity,
  assertSupplierChat:assertSupplierChatIdentity,
  normalizeError:normalizeChatError
};
