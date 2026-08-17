const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

[
  'src/features/chat/chatIdentity.js',
  'src/features/chat/chatRepository.js',
  'src/features/chat/chatRuntime.js',
  'src/features/chat/index.js',
  'src/features/chat/chatUi.js'
].forEach(file => vm.runInThisContext(fs.readFileSync(file, 'utf8')));

const styleId = '9c11fd42-0d53-4ed6-82f1-c1d4bc7b88a9';
const groupId = '1cf0b5b1-7f2a-4c8d-a1e2-91f9d91f39c0';
const conversationId = '4f873499-0332-4073-9b33-69dca7133896';
const userId = '9e3f9e52-b810-46e4-a2a0-5ed7ad5238cb';
const companyId = '1a59f43d-c64e-47dc-8b76-cfd541eed42c';

function target() {
  return {
    html: '',
    innerHTML: '',
    querySelector() {
      return { scrollTop: 0, scrollHeight: 0 };
    }
  };
}

function runtimeFixture() {
  const calls = [];
  const conversation = {
    conversationId,
    type: 'STYLE_COMMERCIAL',
    styleId,
    supplierCompanyId: '25f19272-6253-4691-9df6-256614ef66d0',
    brandCompanyGroupId: groupId,
    brandStyleContextId: 'c675dd36-026d-4810-8bc8-bb35f21bc702',
    status: 'ACTIVE',
    unread: 1,
    lastMessage: { body: 'Latest note', createdAt: '2026-08-17T10:00:00Z' }
  };
  const supplierConversation = {
    conversationId: '11111111-2222-4333-8444-555555555555',
    type: 'SUPPLIER_GENERAL',
    supplierCompanyId: '25f19272-6253-4691-9df6-256614ef66d0',
    brandCompanyGroupId: groupId,
    status: 'ACTIVE'
  };
  return {
    calls,
    listConversations() {
      calls.push({ type: 'listConversations' });
      return Promise.resolve({ ok: true, data: [] });
    },
    loadThread(id) {
      calls.push({ type: 'loadThread', conversationId: id });
      return Promise.resolve({ ok: true, data: [{
        messageId: 'm1',
        conversationId: id,
        senderUserId: userId,
        senderCompanyId: companyId,
        body: 'Latest note',
        createdAt: '2026-08-17T10:00:00Z',
        attachments: [
          { attachmentId: 'a1', messageId: 'm1', storageBucket: 'product-photos', storagePath: 'chat/2026/a1.pdf', fileName: 'spec.pdf', contentType: 'application/pdf', byteSize: 2048 },
          { attachmentId: 'a2', messageId: 'm1', storagePath: 'data:image/png;base64,abc', fileName: 'bad.png', contentType: 'image/png', byteSize: 12 },
          { attachmentId: 'a3', messageId: 'm1', storagePath: 'style_901/bad.pdf', fileName: 'legacy.pdf', contentType: 'application/pdf', byteSize: 12 }
        ]
      }] });
    },
    markRead(cursor) {
      calls.push({ type: 'markRead', cursor });
      return Promise.resolve({ ok: true, data: cursor });
    },
    openStyleConversation(context) {
      calls.push({ type: 'openStyleConversation', context });
      return Promise.resolve({ ok: true, data: conversation });
    },
    openSupplierConversation(context) {
      calls.push({ type: 'openSupplierConversation', context });
      return Promise.resolve({ ok: true, data: supplierConversation });
    },
    sendMessage(message) {
      calls.push({ type: 'sendMessage', message });
      return Promise.resolve({ ok: true, data: Object.assign({ messageId: 'm2', createdAt: '2026-08-17T10:01:00Z' }, message) });
    },
    uploadAttachment(input) {
      calls.push({ type: 'uploadAttachment', input });
      return Promise.resolve({ ok: true, data: { path: input.storagePath } });
    },
    addAttachmentMetadata(input) {
      calls.push({ type: 'addAttachmentMetadata', input });
      return Promise.resolve({ ok: true, data: Object.assign({ attachmentId: 'att-' + input.fileName, createdAt: '2026-08-17T10:02:00Z' }, input) });
    }
  };
}

function listPolishRuntimeFixture() {
  return {
    listConversations() {
      return Promise.resolve({ ok: true, data: [
        {
          conversationId: '30000000-0000-4000-8000-000000000000',
          type: 'STYLE_COMMERCIAL',
          styleId: '30000000-0000-4000-8000-000000000001',
          supplierCompanyId: '25f19272-6253-4691-9df6-256614ef66d0',
          status: 'PENDING',
          unread: 0,
          updatedAt: '2026-08-17T08:00:00Z',
          lastMessage: { body: 'Older pending conversation', createdAt: '2026-08-17T08:30:00Z' }
        },
        {
          conversationId: '10000000-0000-4000-8000-000000000000',
          type: 'STYLE_COMMERCIAL',
          styleId: '10000000-0000-4000-8000-000000000001',
          supplierCompanyId: '25f19272-6253-4691-9df6-256614ef66d0',
          status: 'CLOSED',
          unread: 7,
          updatedAt: '2026-08-17T06:00:00Z',
          lastMessage: { body: 'Newest message wins even over unread ordering', createdAt: '2026-08-17T12:00:00Z' }
        },
        {
          conversationId: '20000000-0000-4000-8000-000000000000',
          type: 'SUPPLIER_GENERAL',
          supplierCompanyId: '99999999-8888-4777-8666-555555555555',
          status: 'PENDING',
          unread: 3,
          updatedAt: '2026-08-17T11:00:00Z',
          createdAt: '2026-08-16T11:00:00Z'
        },
        {
          conversationId: '40000000-0000-4000-8000-000000000000',
          type: 'STYLE_COMMERCIAL',
          styleId: '40000000-0000-4000-8000-000000000001',
          supplierCompanyId: '25f19272-6253-4691-9df6-256614ef66d0',
          status: 'CLOSED',
          unread: 0,
          createdAt: '2026-08-16T08:00:00Z',
          lastMessage: { body: 'Old closed no unread', createdAt: '2026-08-16T08:30:00Z' }
        }
      ] });
    },
    loadThread() { return Promise.resolve({ ok: true, data: [] }); },
    markRead() { return Promise.resolve({ ok: true, data: {} }); }
  };
}

function listPanelHtml(html) {
  const end = html.indexOf('<div class="chat-thread-panel">');
  return end >= 0 ? html.slice(0, end) : html;
}

(async function run() {
  const runtime = runtimeFixture();
  let openedChat = false;
  let openedProduct = '';
  const ui = CanonicalChatUI.create({
    runtime,
    helpers: {
      currentGroupId: () => groupId,
      currentUserId: () => userId,
      currentCompanyId: () => companyId,
      isMobile: () => true,
      openChatPage: () => { openedChat = true; },
      openProduct: (id) => { openedProduct = id; },
      styleForId: (id) => id === styleId ? { modelo: 'ST-001', desc: 'Denim jacket', photo: 'photo.jpg', supplier: 'Supplier A' } : null,
      supplierForId: () => ({ name: 'Supplier A' }),
      isSupplierUnlocked: (product) => product.unlocked !== false,
      chatAttachmentBucket: () => 'product-photos',
      attachmentUrl: (attachment) => attachment.storageBucket === 'product-photos' ? 'https://cdn.test/' + attachment.storagePath : ''
    }
  });

  const emptyTarget = target();
  await ui.refresh();
  ui.renderGlobal(emptyTarget);
  assert(emptyTarget.innerHTML.includes('No conversations yet.'), 'Empty canonical inbox must be explicit');
  assert(!emptyTarget.innerHTML.includes('[CHAT:'), 'Canonical empty inbox must not render legacy chat markers');

  const productTarget = target();
  ui.renderProductCommunication(productTarget, { styleId, supplierName: 'Supplier A', unlocked: true });
  assert(productTarget.innerHTML.includes('Message Supplier'), 'Unlocked product should show Message Supplier');

  const lockedTarget = target();
  ui.renderProductCommunication(lockedTarget, { styleId, supplierName: 'Supplier A', unlocked: false });
  assert(lockedTarget.innerHTML.includes('Chat unavailable'), 'Locked supplier state should hide message action');

  const opened = await ui.openStyleConversation({ styleId, legacyRowId: 901 });
  assert.strictEqual(opened.ok, true, 'Product to Chat should open canonical style conversation');
  assert.strictEqual(openedChat, true, 'Product to Chat should navigate to global chat');
  assert.deepStrictEqual(
    runtime.calls.find(call => call.type === 'openStyleConversation').context,
    { styleId, brandCompanyGroupId: groupId },
    'Style opening must pass only canonical styleId and group context'
  );
  assert.strictEqual(ui.state.selectedConversationId, conversationId, 'Selected thread identity is conversationId');
  assert.strictEqual(ui.state.mobileThreadOpen, true, 'Mobile opening moves from list to thread');

  const populatedTarget = target();
  ui.renderGlobal(populatedTarget);
  assert(populatedTarget.innerHTML.includes('ST-001'), 'Populated inbox should render style conversation');
  assert(populatedTarget.innerHTML.includes('Open Product'), 'Thread header should expose Chat to Product action');
  assert(populatedTarget.innerHTML.includes('canonical-chat-input'), 'Composer should be canonical');
  assert(populatedTarget.innerHTML.includes('spec.pdf'), 'Canonical attachment metadata should render');
  assert(!populatedTarget.innerHTML.includes('bad.png'), 'Data URL attachments should not render');
  assert(!populatedTarget.innerHTML.includes('legacy.pdf'), 'Legacy style path attachments should not render');
  assert(populatedTarget.innerHTML.includes('https://cdn.test/chat/2026/a1.pdf'), 'Canonical attachment metadata should resolve to a downloadable URL');

  const embeddedTarget = target();
  await ui.renderProductConversation(embeddedTarget, { styleId, brandCompanyGroupId: groupId, supplierName: 'Supplier A', unlocked: true });
  assert(embeddedTarget.innerHTML.includes('canonical-product-chat-embedded'), 'Style sidebar should render the same canonical thread inline when it exists');
  assert(embeddedTarget.innerHTML.includes('ST-001'), 'Embedded Style chat should keep product name instead of UUID fallback');

  ui.openProduct();
  assert.strictEqual(openedProduct, styleId, 'Chat to Product uses canonical styles.id');

  const supplierOpened = await ui.openSupplierConversation({ supplierCompanyId: '25f19272-6253-4691-9df6-256614ef66d0' });
  assert.strictEqual(supplierOpened.ok, true, 'Supplier-general chat should be supported');
  assert.strictEqual(
    runtime.calls.some(call => call.type === 'openSupplierConversation' && call.context.brandCompanyGroupId === groupId),
    true,
    'Supplier-general opening must include group context'
  );

  await ui.sendCurrentMessage('Hello');
  await ui.sendCurrentMessage('Second');
  ui.addPendingFiles([{ name: 'fit.png', type: 'image/png', size: 4096 }]);
  await ui.sendCurrentMessage('');
  const sendCalls = runtime.calls.filter(call => call.type === 'sendMessage');
  assert.strictEqual(sendCalls.length, 3, 'Composer sends via runtime');
  assert.strictEqual(sendCalls[0].message.conversationId, ui.state.selectedConversationId, 'Message uses selected canonical conversationId');
  assert.strictEqual(sendCalls[0].message.senderUserId, userId, 'Message attribution keeps sender user');
  assert.strictEqual(sendCalls[0].message.senderCompanyId, companyId, 'Message attribution keeps sender company');
  assert.strictEqual(runtime.calls.some(call => call.type === 'uploadAttachment' && call.input.storageBucket === 'product-photos' && /^chat\//.test(call.input.storagePath)), true, 'Composer uploads pending files to stable chat storage paths');
  assert.strictEqual(runtime.calls.some(call => call.type === 'addAttachmentMetadata' && call.input.messageId && call.input.fileName === 'fit.png'), true, 'Composer persists attachment metadata against the canonical message');
  assert.strictEqual(ui.state.pendingAttachments.length, 0, 'Successful send clears pending attachment chips');

  const pasteEvent = {
    prevented: false,
    preventDefault() { this.prevented = true; },
    clipboardData: { items: [{ kind: 'file', type: 'image/png', getAsFile: () => ({ name: 'paste.png', type: 'image/png', size: 12 }) }] }
  };
  assert.strictEqual(ui.handlePaste(pasteEvent), true, 'Chat composer should capture pasted images');
  assert.strictEqual(pasteEvent.prevented, true, 'Pasted images should not fall through to product-photo paste handler');
  assert.strictEqual(ui.state.pendingAttachments.length, 1, 'Pasted image should become a pending chat attachment');

  ui.state.sending = true;
  const blocked = await ui.sendCurrentMessage('Duplicate');
  assert.strictEqual(blocked.ok, false, 'Duplicate send protection should fail safely while sending');
  ui.state.sending = false;

  ui.backToList();
  assert.strictEqual(ui.state.mobileThreadOpen, false, 'Mobile back returns to list');

  const polishUi = CanonicalChatUI.create({
    runtime: listPolishRuntimeFixture(),
    helpers: {
      currentUserId: () => userId,
      currentCompanyId: () => companyId,
      isMobile: () => false,
      styleForId: (id) => ({
        '10000000-0000-4000-8000-000000000001': { modelo: 'STYLE-NEWEST-MESSAGE-WINS-LONG-LONG-LONG', desc: 'A very long product description that must not collide with right side metadata', supplier: 'Supplier A' },
        '30000000-0000-4000-8000-000000000001': { modelo: 'STYLE-PENDING-ZERO-UNREAD', desc: 'Pending no unread', supplier: 'Supplier A' },
        '40000000-0000-4000-8000-000000000001': { modelo: 'STYLE-CLOSED-ZERO-UNREAD', desc: 'Closed no unread', supplier: 'Supplier A' }
      }[id] || null),
      supplierForId: (id) => id === '99999999-8888-4777-8666-555555555555'
        ? { name: 'Very Long Supplier Name For General Conversation That Must Truncate Safely' }
        : { name: 'Supplier A' }
    }
  });
  await polishUi.refresh();
  const polishTarget = target();
  polishUi.renderGlobal(polishTarget);
  const listHtml = listPanelHtml(polishTarget.innerHTML);
  const newestIdx = listHtml.indexOf('10000000-0000-4000-8000-000000000000');
  const fallbackIdx = listHtml.indexOf('20000000-0000-4000-8000-000000000000');
  const pendingIdx = listHtml.indexOf('30000000-0000-4000-8000-000000000000');
  const oldClosedIdx = listHtml.indexOf('40000000-0000-4000-8000-000000000000');
  assert(newestIdx >= 0 && fallbackIdx > newestIdx && pendingIdx > fallbackIdx && oldClosedIdx > pendingIdx, 'Newest activity must sort first, then timestamp fallback, independent of unread');
  assert(listHtml.includes('chat-status-dot closed'), 'Closed conversations render a green status dot class');
  assert(listHtml.includes('chat-status-dot pending'), 'Pending conversations render an orange status dot class');
  assert(!listHtml.includes('>CLOSED<') && !listHtml.includes('>PENDING<'), 'Inbox must not render large CLOSED/PENDING text pills');
  assert(listHtml.includes('chat-list-unread') && listHtml.includes('>7<') && listHtml.includes('>3<'), 'Unread count is separate and visible when greater than zero');
  assert(!/STYLE-PENDING-ZERO-UNREAD[\s\S]*chat-list-unread/.test(listHtml), 'Unread zero remains hidden');
  assert(listHtml.includes('chat-status-dot closed') && listHtml.includes('chat-list-unread'), 'Status dot must not replace unread count');
  assert(!listHtml.includes('No style'), 'Supplier-general conversation must not show awkward No style text');
  assert(listHtml.includes('Very Long Supplier Name For General Conversation'), 'Supplier-general title should use supplier name');
  assert(listHtml.includes('chat-row-top') && listHtml.includes('chat-row-meta') && listHtml.includes('chat-row-subtitle'), 'Conversation rows use truncation-safe hierarchy');

  const mobilePolishUi = CanonicalChatUI.create({
    runtime: listPolishRuntimeFixture(),
    helpers: {
      currentUserId: () => userId,
      currentCompanyId: () => companyId,
      isMobile: () => true,
      styleForId: (id) => id === '10000000-0000-4000-8000-000000000001'
        ? { modelo: 'MOBILE-LONG-STYLE-REFERENCE-THAT-SHOULD-ELLIPSIZE', desc: 'Mobile long preview text that should remain clear', supplier: 'Supplier A' }
        : null,
      supplierForId: () => ({ name: 'Mobile Supplier Name' })
    }
  });
  await mobilePolishUi.refresh();
  const mobileTarget = target();
  mobilePolishUi.renderGlobal(mobileTarget);
  assert(mobileTarget.innerHTML.includes('chat-row-meta') && mobileTarget.innerHTML.includes('chat-list-unread'), 'Mobile list keeps status and unread metadata available');

  const source = fs.readFileSync('src/features/chat/chatUi.js', 'utf8');
  assert(!source.includes('.from('), 'Canonical Chat UI must not call Supabase tables directly');
  assert(!source.includes('.rpc('), 'Canonical Chat UI must not call Supabase RPCs directly');
  assert(!source.includes('brand_style_contexts'), 'Canonical Chat UI must not insert or reference brand_style_contexts directly');
  assert(!source.includes('negotiation_rows'), 'Canonical Chat UI must not write negotiation_rows');
  assert(!source.includes('[CHAT:'), 'Canonical Chat UI must not parse legacy [CHAT:]');
  assert(!source.includes('styleChatMessages'), 'Canonical Chat UI must not render legacy chat messages');
  assert(!source.includes('setStyleChatMessages'), 'Canonical Chat UI must not dual-write legacy chat');

  console.log('canonical chat UI clean cutover characterization ok');
})();
