const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

[
  'src/features/chat/chatIdentity.js',
  'src/features/chat/chatRepository.js',
  'src/features/chat/chatRuntime.js',
  'src/features/chat/index.js'
].forEach(file => vm.runInThisContext(fs.readFileSync(file, 'utf8')));

const STYLE_ID = '9c11fd42-0d53-4ed6-82f1-c1d4bc7b88a9';
const SUPPLIER_COMPANY_ID = '25f19272-6253-4691-9df6-256614ef66d0';
const GROUP_ID = '1cf0b5b1-7f2a-4c8d-a1e2-91f9d91f39c0';
const CONVERSATION_ID = '4f873499-0332-4073-9b33-69dca7133896';
const USER_ID = '9e3f9e52-b810-46e4-a2a0-5ed7ad5238cb';
const COMPANY_ID = '1a59f43d-c64e-47dc-8b76-cfd541eed42c';

function createSupabaseMock() {
  const calls = [];
  const state = {
    rpcResult: {
      id: CONVERSATION_ID,
      conversation_type: 'STYLE_COMMERCIAL',
      style_id: STYLE_ID,
      supplier_company_id: SUPPLIER_COMPANY_ID,
      brand_company_group_id: GROUP_ID,
      brand_style_context_id: 'c675dd36-026d-4810-8bc8-bb35f21bc702',
      status: 'ACTIVE',
      updated_at: '2026-08-17T10:00:00Z'
    },
    messageResult: {
      id: '3a93feb9-bf05-4511-8c25-b10cd9478e50',
      conversation_id: CONVERSATION_ID,
      sender_user_id: USER_ID,
      sender_company_id: COMPANY_ID,
      body: 'Hello supplier',
      body_format: 'PLAIN_TEXT',
      created_at: '2026-08-17T10:01:00Z'
    },
    readResult: {
      conversation_id: CONVERSATION_ID,
      user_id: USER_ID,
      company_id: COMPANY_ID,
      last_read_message_id: '3a93feb9-bf05-4511-8c25-b10cd9478e50',
      last_read_at: '2026-08-17T10:02:00Z'
    },
    attachmentResult: {
      id: 'fabcc242-45a1-49c6-a61b-681138814919',
      conversation_id: CONVERSATION_ID,
      message_id: '3a93feb9-bf05-4511-8c25-b10cd9478e50',
      storage_bucket: 'chat',
      storage_path: `chat/${CONVERSATION_ID}/fit-photo.jpg`,
      file_name: 'fit-photo.jpg',
      content_type: 'image/jpeg',
      byte_size: 1234,
      uploaded_by: USER_ID,
      created_at: '2026-08-17T10:03:00Z'
    }
  };

  function responseFor(table, action) {
    if (table === 'chat_messages' && action === 'insert') return { data: state.messageResult, error: null };
    if (table === 'chat_conversation_reads' && action === 'upsert') return { data: state.readResult, error: null };
    if (table === 'chat_message_attachments' && action === 'insert') return { data: state.attachmentResult, error: null };
    return { data: [], error: null };
  }

  return {
    calls,
    state,
    rpc(name, params) {
      calls.push({ type: 'rpc', name, params });
      return { data: state.rpcResult, error: null };
    },
    from(table) {
      const chain = {
        select(columns) { calls.push({ type: 'select', table, columns }); return chain; },
        eq(column, value) { calls.push({ type: 'eq', table, column, value }); return chain; },
        order(column, options) { calls.push({ type: 'order', table, column, options }); return chain; },
        maybeSingle() { calls.push({ type: 'maybeSingle', table }); return { data: null, error: null }; },
        single() { calls.push({ type: 'single', table }); return responseFor(table, chain._lastWrite); },
        insert(row) { calls.push({ type: 'insert', table, row }); chain._lastWrite = 'insert'; return chain; },
        upsert(row, options) { calls.push({ type: 'upsert', table, row, options }); chain._lastWrite = 'upsert'; return chain; }
      };
      return chain;
    }
  };
}

(async function run() {
  const supabase = createSupabaseMock();
  const repository = ChatDomain.createRepository(supabase);
  const runtime = ChatDomain.createRuntime(repository);

  let opened = await runtime.openStyleConversation({
    styleId: STYLE_ID,
    brandCompanyGroupId: GROUP_ID,
    legacyRowId: 501
  });
  assert.strictEqual(opened.ok, true, 'Style Chat should open through canonical runtime');
  assert.strictEqual(opened.data.conversationId, CONVERSATION_ID, 'Conversation identity is conversationId');
  assert.strictEqual(opened.data.styleId, STYLE_ID, 'Style Chat uses canonical styleId');
  assert.strictEqual(opened.data.brandCompanyGroupId, GROUP_ID, 'RPC result keeps group context');
  assert.strictEqual(opened.data.brandStyleContextId, 'c675dd36-026d-4810-8bc8-bb35f21bc702', 'Brand context identity is normalized from RPC result');

  const styleRpc = supabase.calls.find(call => call.type === 'rpc' && call.name === 'get_or_create_style_chat_conversation');
  assert.deepStrictEqual(styleRpc.params, {
    p_style_id: STYLE_ID,
    p_brand_company_group_id: GROUP_ID
  }, 'Style Chat RPC receives styleId and group context');

  opened = await runtime.openStyleConversation({ styleId: '501', brandCompanyGroupId: GROUP_ID, legacyRowId: 501 });
  assert.strictEqual(opened.ok, false, 'Style Chat must fail closed when row id is used as product identity');
  assert.strictEqual(opened.code, ChatDomain.identity.errorCodes.STYLE_NOT_AVAILABLE);

  supabase.state.rpcResult = {
    id: CONVERSATION_ID,
    conversation_type: 'SUPPLIER_GENERAL',
    supplier_company_id: SUPPLIER_COMPANY_ID,
    brand_company_group_id: GROUP_ID,
    status: 'ACTIVE'
  };
  opened = await runtime.openSupplierConversation({
    supplierCompanyId: SUPPLIER_COMPANY_ID,
    brandCompanyGroupId: GROUP_ID
  });
  assert.strictEqual(opened.ok, true, 'Supplier Chat should open through canonical runtime');
  assert.strictEqual(opened.data.supplierCompanyId, SUPPLIER_COMPANY_ID, 'Supplier Chat uses supplier identity');

  const supplierRpc = supabase.calls.find(call => call.type === 'rpc' && call.name === 'get_or_create_supplier_chat_conversation');
  assert.deepStrictEqual(supplierRpc.params, {
    p_supplier_company_id: SUPPLIER_COMPANY_ID,
    p_brand_company_group_id: GROUP_ID
  }, 'Supplier Chat RPC receives supplierCompanyId and group context');

  assert.strictEqual(
    supabase.calls.some(call => call.type === 'insert' && call.table === 'brand_style_contexts'),
    false,
    'Brand Context must not be created client-side'
  );
  assert.strictEqual(
    supabase.calls.some(call => call.type === 'insert' && call.table === 'chat_conversations'),
    false,
    'Conversation creation must not use direct chat_conversations inserts'
  );

  const sent = await runtime.sendMessage({
    conversationId: CONVERSATION_ID,
    senderUserId: USER_ID,
    senderCompanyId: COMPANY_ID,
    body: 'Hello supplier'
  });
  assert.strictEqual(sent.ok, true, 'Message send should normalize repository response');
  assert.strictEqual(sent.data.messageId, '3a93feb9-bf05-4511-8c25-b10cd9478e50', 'Message identity is normalized');
  assert.strictEqual(sent.data.senderUserId, USER_ID, 'Message sender user identity is normalized');
  assert.strictEqual(sent.data.senderCompanyId, COMPANY_ID, 'Message sender company identity is normalized');

  const messageInsert = supabase.calls.find(call => call.type === 'insert' && call.table === 'chat_messages');
  assert.strictEqual(messageInsert.row.conversation_id, CONVERSATION_ID, 'Message write uses conversationId');
  assert.strictEqual(messageInsert.row.body_format, 'PLAIN_TEXT', 'Canonical messages stay plain text');

  const read = await runtime.markRead({
    conversationId: CONVERSATION_ID,
    userId: USER_ID,
    companyId: COMPANY_ID,
    lastReadMessageId: sent.data.messageId
  });
  assert.strictEqual(read.ok, true, 'Read cursor should normalize repository response');
  assert.strictEqual(read.data.userId, USER_ID, 'Read cursor is per user');

  const readUpsert = supabase.calls.find(call => call.type === 'upsert' && call.table === 'chat_conversation_reads');
  assert.strictEqual(readUpsert.options.onConflict, 'conversation_id,user_id', 'Read cursor is keyed per conversation and user');

  const attachment = await runtime.addAttachmentMetadata({
    conversationId: CONVERSATION_ID,
    messageId: sent.data.messageId,
    storagePath: `chat/${CONVERSATION_ID}/fit-photo.jpg`,
    fileName: 'fit-photo.jpg',
    contentType: 'image/jpeg',
    byteSize: 1234,
    uploadedBy: USER_ID
  });
  assert.strictEqual(attachment.ok, true, 'Attachment metadata should normalize');
  assert.strictEqual(attachment.data.storageBucket, 'chat', 'Attachment model uses private chat bucket metadata');

  const dataUrl = await runtime.addAttachmentMetadata({
    conversationId: CONVERSATION_ID,
    messageId: sent.data.messageId,
    storagePath: 'data:image/png;base64,AAAA',
    fileName: 'inline.png',
    contentType: 'image/png',
    byteSize: 12,
    uploadedBy: USER_ID
  });
  assert.strictEqual(dataUrl.ok, false, 'Canonical attachment adapter must reject data URLs');
  assert.strictEqual(dataUrl.code, ChatDomain.identity.errorCodes.SEND_DENIED);

  const lockedRepo = {
    getOrCreateStyleConversation() { return { data: null, error: { message: 'Supplier is not unlocked for this Brand company' } }; }
  };
  const locked = await ChatDomain.createRuntime(lockedRepo).openStyleConversation({ styleId: STYLE_ID, brandCompanyGroupId: GROUP_ID });
  assert.strictEqual(locked.ok, false, 'Locked supplier errors fail safely');
  assert.strictEqual(locked.code, ChatDomain.identity.errorCodes.SUPPLIER_LOCKED);

  const source = [
    fs.readFileSync('src/features/chat/chatIdentity.js', 'utf8'),
    fs.readFileSync('src/features/chat/chatRepository.js', 'utf8'),
    fs.readFileSync('src/features/chat/chatRuntime.js', 'utf8')
  ].join('\n');
  assert(!/\[CHAT:/.test(source), 'Canonical adapter must never parse legacy [CHAT:]');
  assert(!/negotiation_rows/.test(source), 'Canonical adapter must never write negotiation_rows.notes');

  console.log('canonical chat frontend adapter characterization ok');
})();
