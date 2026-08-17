function createCanonicalChatUi(options){
  options=options||{};
  var runtime=options.runtime;
  var helpers=options.helpers||{};
  var state={
    conversations:[],
    messages:{},
    selectedConversationId:'',
    mobileThreadOpen:false,
    loading:false,
    sending:false,
    error:'',
    productPreview:{}
  };

  function h(value){
    if(helpers.escapeHtml)return helpers.escapeHtml(value);
    return String(value==null?'':value).replace(/[&<>"']/g,function(ch){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];
    });
  }
  function formatTime(value){
    if(helpers.formatTime)return helpers.formatTime(value);
    if(!value)return '';
    try{return new Date(value).toLocaleString();}catch(e){return String(value);}
  }
  function timestampValue(value){
    if(!value)return 0;
    var time=new Date(value).getTime();
    return Number.isFinite(time)?time:0;
  }
  function notify(message,type){
    if(helpers.toast)helpers.toast(message,type||'warn');
  }
  function isMobile(){
    return !!(helpers.isMobile?helpers.isMobile():(typeof window!=='undefined'&&window.matchMedia&&window.matchMedia('(max-width: 768px)').matches));
  }
  function styleForConversation(conversation){
    return helpers.styleForId?helpers.styleForId(conversation&&conversation.styleId):null;
  }
  function supplierForConversation(conversation){
    if(helpers.supplierForId)return helpers.supplierForId(conversation&&conversation.supplierCompanyId);
    return null;
  }
  function thumbForConversation(conversation){
    var style=styleForConversation(conversation)||{};
    var img=style.photo||style.photo2||style.main_image||'';
    return '<div class="chat-row-thumb">'+(img?'<img src="'+h(img)+'" alt="">':'<span>Chat</span>')+'</div>';
  }
  function titleForConversation(conversation){
    var style=styleForConversation(conversation)||{};
    var supplier=supplierForConversation(conversation)||{};
    if(conversation.type==='STYLE_COMMERCIAL')return style.modelo||style.style_ref||style.title||conversation.styleId||'Style conversation';
    return supplier.name||conversation.supplierCompanyId||'Supplier conversation';
  }
  function subtitleForConversation(conversation){
    var style=styleForConversation(conversation)||{};
    var supplier=supplierForConversation(conversation)||{};
    if(conversation.type==='STYLE_COMMERCIAL')return [supplier.name||style.supplier||'Supplier',style.desc||style.description||''].filter(Boolean).join(' - ');
    return 'Supplier general conversation';
  }
  function lastMessageFor(conversation){
    if(conversation.lastMessage)return conversation.lastMessage;
    var msgs=state.messages[conversation.conversationId]||[];
    return msgs.length?msgs[msgs.length-1]:null;
  }
  function activityTimeFor(conversation){
    var msg=lastMessageFor(conversation);
    return Math.max(
      timestampValue(msg&&msg.createdAt),
      timestampValue(msg&&msg.created_at),
      timestampValue(conversation&&conversation.lastMessageAt),
      timestampValue(conversation&&conversation.updatedAt),
      timestampValue(conversation&&conversation.createdAt)
    );
  }
  function sortConversations(){
    state.conversations.sort(function(a,b){
      return activityTimeFor(b)-activityTimeFor(a);
    });
  }
  function previewFor(conversation){
    var msg=lastMessageFor(conversation);
    if(!msg)return 'No messages yet.';
    return (msg.body||'Attachment').slice(0,120);
  }
  function unreadFor(conversation){
    if(typeof conversation.unread==='number')return conversation.unread;
    if(conversation.unread===true)return 1;
    return 0;
  }
  function statusClassFor(conversation){
    var status=String(conversation&&conversation.status||'').toUpperCase();
    if(status==='CLOSED')return 'closed';
    if(status==='PENDING')return 'pending';
    return 'neutral';
  }
  function selectedConversation(){
    return state.conversations.filter(function(c){return c.conversationId===state.selectedConversationId;})[0]||state.conversations[0]||null;
  }
  function setResultError(result,fallback){
    state.error=(result&&result.message)||fallback||'Chat action failed';
    notify(state.error,'err');
  }
  function renderInto(el,html){
    if(el)el.innerHTML=html;
  }

  function renderConversationList(){
    sortConversations();
    var html='<div class="chat-list-panel"><div class="chat-list-head"><b>Chat</b></div>';
    if(!state.conversations.length){
      html+='<div class="chat-empty">No conversations yet.</div>';
      html+='</div>';
      return html;
    }
    state.conversations.forEach(function(conversation){
      var selected=conversation.conversationId===state.selectedConversationId;
      var unread=unreadFor(conversation);
      html+='<button class="chat-row '+(selected?'on':'')+'" data-chat-conversation-id="'+h(conversation.conversationId)+'" onclick="selectCanonicalChatConversation(\''+h(conversation.conversationId)+'\')">';
      html+=thumbForConversation(conversation);
      html+='<span class="chat-row-main"><span class="chat-row-top"><b>'+h(titleForConversation(conversation))+'</b><span class="chat-row-meta">';
      html+='<i class="chat-status-dot '+h(statusClassFor(conversation))+'" aria-hidden="true"></i>';
      if(unread)html+='<strong class="chat-list-unread">'+h(unread>99?'99+':unread)+'</strong>';
      html+='</span></span><span class="chat-row-subtitle">'+h(subtitleForConversation(conversation))+'</span><small>'+h(previewFor(conversation))+'</small></span>';
      html+='</button>';
    });
    html+='</div>';
    return html;
  }

  function renderMessages(conversation){
    if(!conversation)return '<div class="chat-empty">Select a conversation.</div>';
    var messages=state.messages[conversation.conversationId]||[];
    if(!messages.length)return '<div class="chat-empty">No messages yet.</div>';
    return messages.map(function(message){
      var mine=helpers.currentUserId&&message.senderUserId===helpers.currentUserId();
      var attachments=(message.attachments||[]).filter(function(attachment){
        return attachment&&attachment.storagePath&&!/^data:|^https?:|^style_/i.test(attachment.storagePath);
      });
      var html='<div class="style-chat-msg '+(mine?'system':'')+'"><b>'+h(message.senderName||message.senderUserId||'User')+'</b><span>'+h(message.body||'')+'</span><small>'+h(formatTime(message.createdAt))+'</small>';
      attachments.forEach(function(attachment){
        html+='<div class="chat-attachment" data-chat-attachment-id="'+h(attachment.attachmentId)+'"><b>'+h(attachment.fileName||'Attachment')+'</b><small>'+h([attachment.contentType,attachment.byteSize?Math.ceil(attachment.byteSize/1024)+' KB':''].filter(Boolean).join(' - '))+'</small></div>';
      });
      html+='</div>';
      return html;
    }).join('');
  }

  function renderComposer(conversation){
    if(!conversation)return '';
    return '<div class="chat-compose canonical-chat-compose" data-sending="'+(state.sending?'1':'0')+'">'
      +'<div class="chat-compose-actions">'
      +'<button class="chat-attach-btn" type="button" onclick="prepareCanonicalChatAttachment()" title="Attach file" aria-label="Attach file"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05 12 20.5a6 6 0 0 1-8.49-8.49l9.9-9.9a4 4 0 0 1 5.66 5.66l-9.9 9.9a2 2 0 1 1-2.83-2.83l9.2-9.19"/></svg></button>'
      +'</div>'
      +'<textarea id="canonical-chat-input" class="f-modal-inp" placeholder="Write a message" '+(state.sending?'disabled':'')+'></textarea>'
      +'<button type="button" onclick="sendCanonicalChatMessage()" '+(state.sending?'disabled':'')+' title="Send" aria-label="Send"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4 20-7Z"/><path d="M22 2 11 13"/></svg></button>'
      +'</div>';
  }

  function renderThread(conversation){
    var html='<div class="chat-thread-panel">';
    if(!conversation){
      html+='<div class="chat-empty">No conversations yet.</div></div>';
      return html;
    }
    html+='<div class="chat-model-card">';
    html+='<button class="chat-mobile-back" onclick="backToCanonicalChatList()">Back</button>';
    html+=thumbForConversation(conversation);
    html+='<div class="chat-model-info"><b>'+h(titleForConversation(conversation))+'</b><span>'+h(subtitleForConversation(conversation))+'</span><div class="chat-model-tags"><em>'+h(conversation.type==='STYLE_COMMERCIAL'?'Style':'Supplier')+'</em><em>'+h(conversation.status||'ACTIVE')+'</em></div></div>';
    if(conversation.styleId)html+='<button class="chat-model-open" onclick="openCanonicalChatProduct()">Open Product</button>';
    html+='</div>';
    if(state.error)html+='<div class="chat-error">'+h(state.error)+'</div>';
    html+='<div id="canonical-chat-message-list" class="style-chat-list">'+renderMessages(conversation)+'</div>';
    html+=renderComposer(conversation);
    html+='</div>';
    return html;
  }

  function renderGlobal(target){
    var conversation=selectedConversation();
    if(conversation&&!state.selectedConversationId)state.selectedConversationId=conversation.conversationId;
    var html='<div class="chat-inbox canonical-chat '+(state.mobileThreadOpen?'mobile-thread-open':'')+'">';
    html+=renderConversationList();
    html+=renderThread(conversation);
    html+='</div>';
    renderInto(target,html);
    var list=target&&target.querySelector?target.querySelector('#canonical-chat-message-list'):null;
    if(list)list.scrollTop=list.scrollHeight;
  }

  function renderProductCommunication(target,product){
    product=product||{};
    var styleId=ChatIdentity.value(product.styleId||product.style_id);
    var supplier=product.supplierName||product.supplier||'Supplier';
    var groupId=helpers.currentGroupId?helpers.currentGroupId():product.brandCompanyGroupId;
    var unlocked=helpers.isSupplierUnlocked?helpers.isSupplierUnlocked(product):true;
    var existing=state.conversations.filter(function(c){return c.styleId&&c.styleId===styleId;})[0]||null;
    var html='<div class="canonical-product-chat"><div><span>Communication</span><b>'+h(supplier)+'</b>';
    html+='<small>'+h(existing?previewFor(existing):(unlocked?'No canonical conversation yet.':'Chat unavailable.'))+'</small></div>';
    if(!styleId||!ChatIdentity.uuidLike(styleId)||!groupId||!unlocked){
      html+='<button type="button" disabled>Chat unavailable</button>';
    }else{
      html+='<button type="button" onclick="openCanonicalStyleConversationFromProduct(\''+h(styleId)+'\')">'+(existing?'Open conversation':'Message Supplier')+'</button>';
    }
    html+='</div>';
    renderInto(target,html);
  }

  function refresh(){
    if(!runtime||!runtime.listConversations)return Promise.resolve({ok:false,message:'Chat runtime unavailable'});
    state.loading=true;
    return runtime.listConversations().then(function(result){
      state.loading=false;
      if(!result.ok){setResultError(result,'Unable to load conversations');return result;}
      state.conversations=result.data||[];
      sortConversations();
      if(!state.selectedConversationId&&state.conversations.length)state.selectedConversationId=state.conversations[0].conversationId;
      return result;
    });
  }

  function selectConversation(conversationId){
    state.selectedConversationId=ChatIdentity.value(conversationId);
    state.mobileThreadOpen=isMobile();
    var conversation=selectedConversation();
    if(!conversation)return Promise.resolve({ok:false,message:'Conversation not found'});
    var load=runtime.loadThread?runtime.loadThread(conversation.conversationId):Promise.resolve({ok:true,data:[]});
    return Promise.resolve(load).then(function(result){
      if(result.ok)state.messages[conversation.conversationId]=result.data||[];
      if(result.ok&&runtime.markRead&&helpers.currentUserId&&helpers.currentCompanyId){
        var messages=state.messages[conversation.conversationId]||[],last=messages.length?messages[messages.length-1]:null;
        return runtime.markRead({conversationId:conversation.conversationId,userId:helpers.currentUserId(),companyId:helpers.currentCompanyId(),lastReadMessageId:last&&last.messageId||null})
          .then(function(){return result;});
      }
      if(!result.ok)setResultError(result,'Unable to load thread');
      return result;
    });
  }

  function openStyleConversation(product){
    product=product||{};
    var context={styleId:product.styleId||product.style_id,brandCompanyGroupId:product.brandCompanyGroupId||(helpers.currentGroupId&&helpers.currentGroupId())};
    if(!runtime||!runtime.openStyleConversation)return Promise.resolve({ok:false,message:'Chat runtime unavailable'});
    return runtime.openStyleConversation(context).then(function(result){
      if(!result.ok){setResultError(result,'Unable to open conversation');return result;}
      var conversation=result.data;
      if(!state.conversations.some(function(c){return c.conversationId===conversation.conversationId;}))state.conversations.unshift(conversation);
      state.selectedConversationId=conversation.conversationId;
      state.mobileThreadOpen=isMobile();
      if(helpers.openChatPage)helpers.openChatPage();
      return selectConversation(conversation.conversationId).then(function(){return result;});
    });
  }

  function openSupplierConversation(input){
    input=input||{};
    var context={supplierCompanyId:input.supplierCompanyId||input.supplier_company_id,brandCompanyGroupId:input.brandCompanyGroupId||(helpers.currentGroupId&&helpers.currentGroupId())};
    if(!runtime||!runtime.openSupplierConversation)return Promise.resolve({ok:false,message:'Chat runtime unavailable'});
    return runtime.openSupplierConversation(context).then(function(result){
      if(!result.ok){setResultError(result,'Unable to open supplier chat');return result;}
      var conversation=result.data;
      if(!state.conversations.some(function(c){return c.conversationId===conversation.conversationId;}))state.conversations.unshift(conversation);
      state.selectedConversationId=conversation.conversationId;
      state.mobileThreadOpen=isMobile();
      if(helpers.openChatPage)helpers.openChatPage();
      return selectConversation(conversation.conversationId).then(function(){return result;});
    });
  }

  function sendCurrentMessage(text){
    var conversation=selectedConversation();
    text=String(text||'').trim();
    if(state.sending)return Promise.resolve({ok:false,code:ChatIdentity.errorCodes.SEND_DENIED,message:'Message already sending'});
    if(!conversation||!text)return Promise.resolve({ok:false,code:ChatIdentity.errorCodes.SEND_DENIED,message:'Choose a conversation and write a message'});
    if(!helpers.currentUserId||!helpers.currentCompanyId)return Promise.resolve({ok:false,code:ChatIdentity.errorCodes.SEND_DENIED,message:'Missing sender identity'});
    state.sending=true;
    return runtime.sendMessage({conversationId:conversation.conversationId,senderUserId:helpers.currentUserId(),senderCompanyId:helpers.currentCompanyId(),body:text})
      .then(function(result){
        state.sending=false;
        if(!result.ok){setResultError(result,'Unable to send message');return result;}
        if(!state.messages[conversation.conversationId])state.messages[conversation.conversationId]=[];
        state.messages[conversation.conversationId].push(result.data);
        conversation.lastMessage=result.data;
        conversation.updatedAt=result.data.createdAt||conversation.updatedAt;
        sortConversations();
        return result;
      })
      .catch(function(error){
        state.sending=false;
        var result=ChatIdentity.normalizeError(error);
        setResultError(result,'Unable to send message');
        return result;
      });
  }

  function backToList(){
    state.mobileThreadOpen=false;
  }

  function openProduct(){
    var conversation=selectedConversation();
    if(conversation&&conversation.styleId&&helpers.openProduct)helpers.openProduct(conversation.styleId);
  }

  return {
    state:state,
    refresh:refresh,
    renderGlobal:renderGlobal,
    renderProductCommunication:renderProductCommunication,
    selectConversation:selectConversation,
    openStyleConversation:openStyleConversation,
    openSupplierConversation:openSupplierConversation,
    sendCurrentMessage:sendCurrentMessage,
    backToList:backToList,
    openProduct:openProduct
  };
}

var CanonicalChatUI={create:createCanonicalChatUi};
