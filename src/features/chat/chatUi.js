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
    productPreview:{},
    pendingAttachments:[]
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
  function imageFromStyle(style){
    style=style||{};
    if(style.photo||style.photo2||style.main_image)return style.photo||style.photo2||style.main_image;
    if(Array.isArray(style.images)&&style.images.length){
      var main=style.images.filter(function(img){return img&&img.main;})[0]||style.images[0];
      return main&&(main.url||main.src||main.data)||'';
    }
    return '';
  }
  function supplierForConversation(conversation){
    if(helpers.supplierForId)return helpers.supplierForId(conversation&&conversation.supplierCompanyId);
    return null;
  }
  function thumbForConversation(conversation){
    var style=styleForConversation(conversation)||{};
    var img=imageFromStyle(style);
    return '<div class="chat-row-thumb">'+(img?'<img src="'+h(img)+'" alt="">':'<span>Chat</span>')+'</div>';
  }
  function titleForConversation(conversation){
    var style=styleForConversation(conversation)||{};
    var supplier=supplierForConversation(conversation)||{};
    if(conversation.type==='STYLE_COMMERCIAL')return style.modelo||style.style_ref||style.title||style.supplier_reference||'Style conversation';
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
        var url=helpers.attachmentUrl?helpers.attachmentUrl(attachment):'';
        var meta=h([attachment.contentType,attachment.byteSize?Math.ceil(attachment.byteSize/1024)+' KB':''].filter(Boolean).join(' - '));
        var label='<b>'+h(attachment.fileName||'Attachment')+'</b><small>'+meta+'</small>';
        if(url&&/^image\//i.test(attachment.contentType||''))label='<img src="'+h(url)+'" alt="'+h(attachment.fileName||'Attachment')+'">'+label;
        html+=(url?'<a':'<div')+' class="chat-attachment" data-chat-attachment-id="'+h(attachment.attachmentId)+'" '+(url?'href="'+h(url)+'" target="_blank" rel="noopener" download="'+h(attachment.fileName||'attachment')+'"':'')+'>'+label+(url?'</a>':'</div>');
      });
      html+='</div>';
      return html;
    }).join('');
  }
  function pendingAttachmentHtml(){
    if(!state.pendingAttachments.length)return '';
    return '<div class="chat-pending-attachments">'+state.pendingAttachments.map(function(file,i){
      return '<span><b>'+h(file.name||'Pasted image')+'</b><button type="button" onclick="removeCanonicalChatPendingAttachment('+i+')" aria-label="Remove attachment">x</button></span>';
    }).join('')+'</div>';
  }

  function renderComposer(conversation){
    if(!conversation)return '';
    return '<div class="chat-compose canonical-chat-compose" data-sending="'+(state.sending?'1':'0')+'">'
      +pendingAttachmentHtml()
      +'<div class="chat-compose-actions">'
      +'<button class="chat-attach-btn" type="button" onclick="prepareCanonicalChatAttachment()" title="Attach file" aria-label="Attach file"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05 12 20.5a6 6 0 0 1-8.49-8.49l9.9-9.9a4 4 0 0 1 5.66 5.66l-9.9 9.9a2 2 0 1 1-2.83-2.83l9.2-9.19"/></svg></button>'
      +'<input id="canonical-chat-file-input" type="file" multiple style="display:none" onchange="selectCanonicalChatFiles(this.files);this.value=\'\'">'
      +'</div>'
      +'<textarea id="canonical-chat-input" class="f-modal-inp" placeholder="Write a message" onpaste="handleCanonicalChatPaste(event)" '+(state.sending?'disabled':'')+'></textarea>'
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
  function renderEmbeddedThread(target,conversation){
    renderInto(target,'<div class="canonical-product-chat-embedded">'+renderThread(conversation)+'</div>');
    var list=target&&target.querySelector?target.querySelector('#canonical-chat-message-list'):null;
    if(list)list.scrollTop=list.scrollHeight;
  }
  function renderProductConversation(target,product){
    product=product||{};
    var styleId=ChatIdentity.value(product.styleId||product.style_id);
    var existing=state.conversations.filter(function(c){
      return c.styleId&&c.styleId===styleId&&(!product.brandCompanyGroupId||c.brandCompanyGroupId===product.brandCompanyGroupId);
    })[0]||null;
    if(!existing){
      renderProductCommunication(target,product);
      return Promise.resolve({ok:true,data:null});
    }
    state.selectedConversationId=existing.conversationId;
    return selectConversation(existing.conversationId).then(function(result){
      renderEmbeddedThread(target,existing);
      return result;
    });
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

  function openStyleConversation(product,openOptions){
    product=product||{};
    openOptions=openOptions||{};
    var context={styleId:product.styleId||product.style_id,brandCompanyGroupId:product.brandCompanyGroupId||(helpers.currentGroupId&&helpers.currentGroupId())};
    if(!runtime||!runtime.openStyleConversation)return Promise.resolve({ok:false,message:'Chat runtime unavailable'});
    return runtime.openStyleConversation(context).then(function(result){
      if(!result.ok){setResultError(result,'Unable to open conversation');return result;}
      var conversation=result.data;
      if(!state.conversations.some(function(c){return c.conversationId===conversation.conversationId;}))state.conversations.unshift(conversation);
      state.selectedConversationId=conversation.conversationId;
      state.mobileThreadOpen=isMobile();
      if(!openOptions.inline&&helpers.openChatPage)helpers.openChatPage();
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
    var pending=state.pendingAttachments.slice();
    if(state.sending)return Promise.resolve({ok:false,code:ChatIdentity.errorCodes.SEND_DENIED,message:'Message already sending'});
    if(!conversation||(!text&&!pending.length))return Promise.resolve({ok:false,code:ChatIdentity.errorCodes.SEND_DENIED,message:'Choose a conversation and write a message'});
    if(!helpers.currentUserId||!helpers.currentCompanyId)return Promise.resolve({ok:false,code:ChatIdentity.errorCodes.SEND_DENIED,message:'Missing sender identity'});
    state.sending=true;
    return runtime.sendMessage({conversationId:conversation.conversationId,senderUserId:helpers.currentUserId(),senderCompanyId:helpers.currentCompanyId(),body:text||(pending.length>1?pending.length+' attachments':'Attachment')})
      .then(function(result){
        if(!result.ok){state.sending=false;setResultError(result,'Unable to send message');return result;}
        if(!state.messages[conversation.conversationId])state.messages[conversation.conversationId]=[];
        state.messages[conversation.conversationId].push(result.data);
        conversation.lastMessage=result.data;
        conversation.updatedAt=result.data.createdAt||conversation.updatedAt;
        return uploadPendingAttachments(conversation,result.data,pending).then(function(uploadResult){
          state.sending=false;
          if(uploadResult.ok)state.pendingAttachments=[];
          result.attachments=uploadResult.data||[];
          if(result.data)result.data.attachments=result.attachments;
          sortConversations();
          return result;
        });
      })
      .catch(function(error){
        state.sending=false;
        var result=ChatIdentity.normalizeError(error);
        setResultError(result,'Unable to send message');
        return result;
      });
  }
  function sanitizeFileName(name){
    return String(name||'attachment').replace(/[^a-z0-9._-]+/gi,'_').replace(/^_+|_+$/g,'').slice(0,80)||'attachment';
  }
  function attachmentPathFor(conversation,file,index){
    return ['chat',conversation.conversationId,String(Date.now())+'_'+index+'_'+sanitizeFileName(file&&file.name)].join('/');
  }
  function uploadPendingAttachments(conversation,message,pending){
    if(!pending.length)return Promise.resolve({ok:true,data:[]});
    if(!runtime.uploadAttachment||!runtime.addAttachmentMetadata)return Promise.resolve({ok:false,data:[],message:'Attachment upload is unavailable'});
    var uploaded=[],bucket=helpers.chatAttachmentBucket?helpers.chatAttachmentBucket():'product-photos';
    return pending.reduce(function(chain,file,index){
      return chain.then(function(){
        var path=attachmentPathFor(conversation,file,index);
        return runtime.uploadAttachment({file:file,storageBucket:bucket,storagePath:path,contentType:file.type||'application/octet-stream'})
          .then(function(uploadResult){
            if(!uploadResult.ok){setResultError(uploadResult,'Unable to upload attachment');return uploadResult;}
            return runtime.addAttachmentMetadata({
              conversationId:conversation.conversationId,
              messageId:message.messageId,
              storageBucket:bucket,
              storagePath:path,
              fileName:file.name||'attachment',
              contentType:file.type||'application/octet-stream',
              byteSize:file.size||0,
              uploadedBy:helpers.currentUserId()
            }).then(function(metaResult){
              if(!metaResult.ok){setResultError(metaResult,'Unable to save attachment');return metaResult;}
              uploaded.push(metaResult.data);
              return metaResult;
            });
          });
      });
    },Promise.resolve({ok:true})).then(function(last){
      return {ok:uploaded.length===pending.length,data:uploaded,message:last&&last.message};
    });
  }
  function addPendingFiles(files){
    var list=Array.prototype.slice.call(files||[]).filter(function(file){return file&&file.size>0;});
    if(!list.length)return 0;
    state.pendingAttachments=state.pendingAttachments.concat(list).slice(0,8);
    return list.length;
  }
  function removePendingAttachment(index){
    state.pendingAttachments.splice(index,1);
  }
  function handlePaste(event){
    var items=(event&&event.clipboardData&&event.clipboardData.items)||[],files=[];
    for(var i=0;i<items.length;i++){
      if(items[i].kind==='file'&&items[i].type&&items[i].type.indexOf('image/')===0)files.push(items[i].getAsFile());
    }
    if(files.length){event.preventDefault();addPendingFiles(files);return true;}
    return false;
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
    renderProductConversation:renderProductConversation,
    selectConversation:selectConversation,
    openStyleConversation:openStyleConversation,
    openSupplierConversation:openSupplierConversation,
    sendCurrentMessage:sendCurrentMessage,
    addPendingFiles:addPendingFiles,
    removePendingAttachment:removePendingAttachment,
    handlePaste:handlePaste,
    backToList:backToList,
    openProduct:openProduct
  };
}

var CanonicalChatUI={create:createCanonicalChatUi};
