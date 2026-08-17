var CHAT_CONVERSATION_COLUMNS='id,conversation_type,brand_company_id,brand_company_group_id,supplier_company_id,style_id,brand_style_context_id,status,last_message_at,created_at,updated_at';
var CHAT_MESSAGE_COLUMNS='id,conversation_id,sender_user_id,sender_company_id,body,body_format,edited_at,deleted_at,created_at';
var CHAT_ATTACHMENT_COLUMNS='id,conversation_id,message_id,storage_bucket,storage_path,file_name,content_type,byte_size,uploaded_by,created_at';
var CHAT_READ_COLUMNS='conversation_id,user_id,company_id,last_read_message_id,last_read_at,created_at,updated_at';

function createChatRepository(supabase){
  return {
    getOrCreateStyleConversation:function(context){
      return supabase.rpc('get_or_create_style_chat_conversation',{
        p_style_id:context.styleId,
        p_brand_company_group_id:context.brandCompanyGroupId
      });
    },
    getOrCreateSupplierConversation:function(context){
      return supabase.rpc('get_or_create_supplier_chat_conversation',{
        p_supplier_company_id:context.supplierCompanyId,
        p_brand_company_group_id:context.brandCompanyGroupId
      });
    },
    listConversations:function(){
      return supabase.from('chat_conversations')
        .select(CHAT_CONVERSATION_COLUMNS)
        .order('updated_at',{ascending:false});
    },
    loadConversation:function(conversationId){
      return supabase.from('chat_conversations')
        .select(CHAT_CONVERSATION_COLUMNS)
        .eq('id',conversationId)
        .maybeSingle();
    },
    loadMessages:function(conversationId){
      return supabase.from('chat_messages')
        .select(CHAT_MESSAGE_COLUMNS)
        .eq('conversation_id',conversationId)
        .order('created_at',{ascending:true})
        .order('id',{ascending:true});
    },
    sendMessage:function(message){
      return supabase.from('chat_messages')
        .insert({
          conversation_id:message.conversationId,
          sender_user_id:message.senderUserId,
          sender_company_id:message.senderCompanyId,
          body:message.body,
          body_format:'PLAIN_TEXT'
        })
        .select(CHAT_MESSAGE_COLUMNS)
        .single();
    },
    addAttachmentMetadata:function(attachment){
      return supabase.from('chat_message_attachments')
        .insert({
          conversation_id:attachment.conversationId,
          message_id:attachment.messageId,
          storage_bucket:attachment.storageBucket||'chat',
          storage_path:attachment.storagePath,
          file_name:attachment.fileName,
          content_type:attachment.contentType,
          byte_size:attachment.byteSize,
          uploaded_by:attachment.uploadedBy
        })
        .select(CHAT_ATTACHMENT_COLUMNS)
        .single();
    },
    loadAttachments:function(conversationId){
      return supabase.from('chat_message_attachments')
        .select(CHAT_ATTACHMENT_COLUMNS)
        .eq('conversation_id',conversationId)
        .order('created_at',{ascending:true});
    },
    updateReadCursor:function(cursor){
      return supabase.from('chat_conversation_reads')
        .upsert({
          conversation_id:cursor.conversationId,
          user_id:cursor.userId,
          company_id:cursor.companyId,
          last_read_message_id:cursor.lastReadMessageId||null,
          last_read_at:cursor.lastReadAt||new Date().toISOString()
        },{onConflict:'conversation_id,user_id'})
        .select(CHAT_READ_COLUMNS)
        .single();
    }
  };
}
