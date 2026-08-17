function normalizeChatConversation(row){
  row=row||{};
  return {
    conversationId:ChatIdentity.value(row.conversationId||row.id||row.conversation_id),
    type:ChatIdentity.value(row.type||row.conversation_type),
    styleId:ChatIdentity.value(row.styleId||row.style_id),
    brandStyleContextId:ChatIdentity.value(row.brandStyleContextId||row.brand_style_context_id),
    brandCompanyId:ChatIdentity.value(row.brandCompanyId||row.brand_company_id),
    supplierCompanyId:ChatIdentity.value(row.supplierCompanyId||row.supplier_company_id),
    brandCompanyGroupId:ChatIdentity.value(row.brandCompanyGroupId||row.brand_company_group_id),
    status:ChatIdentity.value(row.status||''),
    lastMessageAt:ChatIdentity.value(row.lastMessageAt||row.last_message_at),
    createdAt:ChatIdentity.value(row.createdAt||row.created_at),
    updatedAt:ChatIdentity.value(row.updatedAt||row.updated_at),
    lastMessage:row.lastMessage||row.last_message||null,
    unread:row.unread==null?null:row.unread,
    raw:row
  };
}

function normalizeChatMessage(row){
  row=row||{};
  return {
    messageId:ChatIdentity.value(row.messageId||row.id||row.message_id),
    conversationId:ChatIdentity.value(row.conversationId||row.conversation_id),
    senderUserId:ChatIdentity.value(row.senderUserId||row.sender_user_id),
    senderCompanyId:ChatIdentity.value(row.senderCompanyId||row.sender_company_id),
    body:ChatIdentity.value(row.body),
    bodyFormat:ChatIdentity.value(row.bodyFormat||row.body_format||'PLAIN_TEXT'),
    editedAt:ChatIdentity.value(row.editedAt||row.edited_at),
    deletedAt:ChatIdentity.value(row.deletedAt||row.deleted_at),
    createdAt:ChatIdentity.value(row.createdAt||row.created_at),
    attachments:Array.isArray(row.attachments)?row.attachments.map(normalizeChatAttachment):[],
    raw:row
  };
}

function normalizeChatAttachment(row){
  row=row||{};
  return {
    attachmentId:ChatIdentity.value(row.attachmentId||row.id),
    conversationId:ChatIdentity.value(row.conversationId||row.conversation_id),
    messageId:ChatIdentity.value(row.messageId||row.message_id),
    storageBucket:ChatIdentity.value(row.storageBucket||row.storage_bucket||'chat'),
    storagePath:ChatIdentity.value(row.storagePath||row.storage_path),
    fileName:ChatIdentity.value(row.fileName||row.file_name),
    contentType:ChatIdentity.value(row.contentType||row.content_type),
    byteSize:Number(row.byteSize==null?row.byte_size:row.byteSize)||0,
    uploadedBy:ChatIdentity.value(row.uploadedBy||row.uploaded_by),
    createdAt:ChatIdentity.value(row.createdAt||row.created_at),
    raw:row
  };
}

function normalizeChatReadCursor(row){
  row=row||{};
  return {
    conversationId:ChatIdentity.value(row.conversationId||row.conversation_id),
    userId:ChatIdentity.value(row.userId||row.user_id),
    companyId:ChatIdentity.value(row.companyId||row.company_id),
    lastReadMessageId:ChatIdentity.value(row.lastReadMessageId||row.last_read_message_id),
    lastReadAt:ChatIdentity.value(row.lastReadAt||row.last_read_at),
    updatedAt:ChatIdentity.value(row.updatedAt||row.updated_at),
    raw:row
  };
}

function chatRuntimeResult(response,normalizer){
  if(response&&response.error)return ChatIdentity.normalizeError(response.error);
  var data=response?response.data:null;
  return {ok:true,data:Array.isArray(data)?data.map(normalizer):normalizer(data)};
}

function createChatRuntime(repository){
  return {
    openStyleConversation:function(input){
      var identity=ChatIdentity.assertStyleChat(input);
      if(!identity.ok)return identity;
      return Promise.resolve(repository.getOrCreateStyleConversation(identity.context))
        .then(function(response){return chatRuntimeResult(response,normalizeChatConversation);})
        .catch(function(error){return ChatIdentity.normalizeError(error);});
    },
    openSupplierConversation:function(input){
      var identity=ChatIdentity.assertSupplierChat(input);
      if(!identity.ok)return identity;
      return Promise.resolve(repository.getOrCreateSupplierConversation(identity.context))
        .then(function(response){return chatRuntimeResult(response,normalizeChatConversation);})
        .catch(function(error){return ChatIdentity.normalizeError(error);});
    },
    listConversations:function(){
      return Promise.resolve(repository.listConversations())
        .then(function(response){return chatRuntimeResult(response,normalizeChatConversation);})
        .catch(function(error){return ChatIdentity.normalizeError(error);});
    },
    loadThread:function(conversationId){
      if(!conversationId)return Promise.resolve({ok:false,code:ChatIdentity.errorCodes.CONVERSATION_NOT_FOUND,message:'conversationId is required'});
      return Promise.resolve(repository.loadMessages(conversationId))
        .then(function(response){
          var messages=chatRuntimeResult(response,normalizeChatMessage);
          if(!messages.ok||!repository.loadAttachments)return messages;
          return Promise.resolve(repository.loadAttachments(conversationId)).then(function(attachmentResponse){
            var attachments=chatRuntimeResult(attachmentResponse,normalizeChatAttachment);
            if(!attachments.ok)return messages;
            var byMessage={};
            (attachments.data||[]).forEach(function(attachment){
              if(!byMessage[attachment.messageId])byMessage[attachment.messageId]=[];
              byMessage[attachment.messageId].push(attachment);
            });
            messages.data=(messages.data||[]).map(function(message){
              message.attachments=byMessage[message.messageId]||[];
              return message;
            });
            return messages;
          });
        })
        .catch(function(error){return ChatIdentity.normalizeError(error);});
    },
    sendMessage:function(message){
      message=message||{};
      if(!message.conversationId||!message.senderUserId||!message.senderCompanyId||!String(message.body||'').trim()){
        return Promise.resolve({ok:false,code:ChatIdentity.errorCodes.SEND_DENIED,message:'conversationId, senderUserId, senderCompanyId and body are required'});
      }
      return Promise.resolve(repository.sendMessage(message))
        .then(function(response){return chatRuntimeResult(response,normalizeChatMessage);})
        .catch(function(error){return ChatIdentity.normalizeError(error);});
    },
    markRead:function(cursor){
      cursor=cursor||{};
      if(!cursor.conversationId||!cursor.userId||!cursor.companyId){
        return Promise.resolve({ok:false,code:ChatIdentity.errorCodes.SEND_DENIED,message:'conversationId, userId and companyId are required'});
      }
      return Promise.resolve(repository.updateReadCursor(cursor))
        .then(function(response){return chatRuntimeResult(response,normalizeChatReadCursor);})
        .catch(function(error){return ChatIdentity.normalizeError(error);});
    },
    addAttachmentMetadata:function(attachment){
      attachment=attachment||{};
      if(!attachment.conversationId||!attachment.messageId||!attachment.storagePath||!attachment.fileName||!attachment.contentType||!attachment.byteSize||!attachment.uploadedBy){
        return Promise.resolve({ok:false,code:ChatIdentity.errorCodes.SEND_DENIED,message:'complete attachment metadata is required'});
      }
      if(/^data:|^https?:/i.test(attachment.storagePath)){
        return Promise.resolve({ok:false,code:ChatIdentity.errorCodes.SEND_DENIED,message:'attachment storagePath must be a private storage path'});
      }
      return Promise.resolve(repository.addAttachmentMetadata(attachment))
        .then(function(response){return chatRuntimeResult(response,normalizeChatAttachment);})
        .catch(function(error){return ChatIdentity.normalizeError(error);});
    },
    normalizeConversation:normalizeChatConversation,
    normalizeMessage:normalizeChatMessage,
    normalizeAttachment:normalizeChatAttachment,
    normalizeReadCursor:normalizeChatReadCursor
  };
}

var ChatRuntime={
  create:createChatRuntime,
  normalizeConversation:normalizeChatConversation,
  normalizeMessage:normalizeChatMessage,
  normalizeAttachment:normalizeChatAttachment,
  normalizeReadCursor:normalizeChatReadCursor
};
