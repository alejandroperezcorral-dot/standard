const assert = require('assert');
const RuntimeConfig = require('../src/core/runtimeConfig.js');

const prod = RuntimeConfig.resolve();
assert.strictEqual(prod.environment, 'production');
assert.strictEqual(prod.projectRef, 'vtyffyywmqnlfemzlsbz');
assert.strictEqual(prod.supabaseUrl, 'https://vtyffyywmqnlfemzlsbz.supabase.co');
assert.strictEqual(prod.proxySupabaseThroughSameOrigin, true);
assert(prod.publishableKey, 'production publishable key must remain configured');

const staging = RuntimeConfig.resolve({
  environment: 'staging',
  projectRef: 'amitkdqyfblymzdsrplx',
  supabaseUrl: 'https://amitkdqyfblymzdsrplx.supabase.co',
  publishableKey: 'sb_publishable_test_key'
});
assert.strictEqual(staging.environment, 'staging');
assert.strictEqual(staging.projectRef, 'amitkdqyfblymzdsrplx');
assert.strictEqual(staging.proxySupabaseThroughSameOrigin, false);

assert.throws(
  () => RuntimeConfig.resolve({ environment: 'staging' }),
  /incomplete/,
  'staging mode must fail closed when config is missing'
);

assert.throws(
  () => RuntimeConfig.resolve({
    environment: 'staging',
    projectRef: 'amitkdqyfblymzdsrplx',
    supabaseUrl: 'https://vtyffyywmqnlfemzlsbz.supabase.co',
    publishableKey: 'sb_publishable_test_key'
  }),
  /production Supabase|does not match/,
  'staging mode must reject production Supabase URLs'
);

assert.throws(
  () => RuntimeConfig.resolve({
    environment: 'staging',
    projectRef: 'amitkdqyfblymzdsrplx',
    supabaseUrl: 'https://amitkdqyfblymzdsrplx.supabase.co',
    serviceRoleKey: 'never'
  }),
  /service-role|service_role/,
  'service-role credentials must not be accepted'
);

console.log('runtime config characterization passed');
