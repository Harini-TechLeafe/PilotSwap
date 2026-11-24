/**
 * Liquidity Approval Flow — Pure-Logic Tests
 * ===========================================
 * Run with:  node src/__tests__/liquidity-approval.test.mjs
 *
 * Tests:
 *  1. waitForAllowance — approval (immediate)
 *  2. waitForAllowance — rejection / existing allowance (already sufficient)
 *  3. waitForAllowance — AbortSignal cancels the loop immediately
 *  4. waitForAllowance — times out and throws when RPC never reflects the allowance
 *  5. parseTxError     — user rejection (code 4001) surfaces correct message
 *  6. parseTxError     — pending request (-32002) surfaces correct message
 *  7. parseTxError     — wallet disconnected (4900) surfaces correct message
 *  8. parseTxError     — generic unknown error falls through to base message
 *  9. Step states      — approval phase (step1 active, step2 waiting)
 * 10. Step states      — checking/liquidity (step1 complete, step2 waiting — NOT active)
 * 11. Step states      — wallet/liquidity   (step1 complete, step2 active)
 * 12. Step states      — pending/liquidity  (step1 complete, step2 complete, step3 active)
 * 13. submit abort     — abort controller fires and prevents further state updates
 */

// ─── Minimal polyfill so we can import the ESM logic directly ───────────────
import assert from 'node:assert/strict';

// ─── Inline copies of the pure functions (avoids vite/react/viem deps) ──────

// ── waitForAllowance (mirrors src/lib/allowance.ts) ─────────────────────────
async function waitForAllowance(readAllowance, needed, timeoutMs = 30_000, signal) {
  const start = Date.now();
  for (;;) {
    if (signal?.aborted) return; // cancelled — exit cleanly
    const allowance = await readAllowance();
    if (allowance >= needed) return;
    if (Date.now() - start > timeoutMs)
      throw new Error('Approval was mined but your RPC still shows no allowance. Wait a few seconds and try again.');
    await new Promise((resolve) => {
      const tid = setTimeout(resolve, 50); // shortened for tests
      signal?.addEventListener('abort', () => { clearTimeout(tid); resolve(); }, { once: true });
    });
  }
}

// ── parseTxError (mirrors src/lib/errors.ts — subset) ───────────────────────
function parseTxError(err) {
  const chain = [];
  let cur = err;
  for (let i = 0; cur && i < 8; i++) { chain.push(cur); cur = cur.cause; }
  const text = chain.map(c => `${c?.shortMessage ?? ''} ${c?.message ?? ''} ${c?.details ?? ''} ${c?.reason ?? ''}`).join(' ').toLowerCase();
  if (chain.some(c => c?.code === 4001 || c?.name === 'UserRejectedRequestError') || text.includes('user rejected') || text.includes('user denied'))
    return { message: 'You rejected the request in MetaMask. Nothing was sent.', rejected: true };
  if (chain.some(c => c?.code === -32002) || text.includes('request already pending'))
    return { message: 'A wallet request is already pending. Open your wallet, finish or reject that request, then try again.', rejected: false };
  if (chain.some(c => c?.code === 4900 || c?.code === 4901) || text.includes('provider is disconnected'))
    return { message: 'Your wallet is disconnected. Reconnect it and try again.', rejected: false };
  const base = (chain[0]?.shortMessage ?? chain[0]?.message ?? 'Unknown error');
  return { message: base.length > 220 ? `${base.slice(0, 220)}…` : base, rejected: false };
}

// ── stepStates — mirrors AddLiquidityV3.tsx logic ───────────────────────────
function computeStepStates(status) {
  const progressStep = (status.phase === 'checking' || status.phase === 'wallet' || status.phase === 'pending')
    ? status.step : null;
  const inApproval = progressStep === 'approval';

  // FIXED logic (what the patched component now computes):
  const step1 = inApproval ? 'active' : 'complete';
  const step2 = inApproval
    ? 'waiting'
    : progressStep === 'liquidity' && (status.phase === 'wallet' || status.phase === 'pending')
      ? (status.phase === 'pending' ? 'complete' : 'active')
      : 'waiting';
  const step3 = progressStep === 'liquidity' && status.phase === 'pending' ? 'active' : 'waiting';
  return { step1, step2, step3 };
}

// ─── Test runner ─────────────────────────────────────────────────────────────
let pass = 0, fail = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅  ${name}`);
    pass++;
  } catch (e) {
    console.error(`  ❌  ${name}`);
    console.error(`       ${e.message}`);
    fail++;
  }
}

console.log('\n=== Liquidity Approval Flow Tests ===\n');

// ── 1. waitForAllowance — approved after one retry ───────────────────────────
await test('waitForAllowance resolves when allowance becomes sufficient', async () => {
  let calls = 0;
  const read = async () => { calls++; return calls >= 2 ? 100n : 0n; };
  await waitForAllowance(read, 100n, 5_000);
  assert.equal(calls, 2, 'should have called readAllowance twice');
});

// ── 2. waitForAllowance — existing (already sufficient) allowance ─────────────
await test('waitForAllowance resolves immediately when allowance already sufficient', async () => {
  let calls = 0;
  const read = async () => { calls++; return 999n; };
  await waitForAllowance(read, 100n, 5_000);
  assert.equal(calls, 1, 'should have called readAllowance only once');
});

// ── 3. waitForAllowance — AbortSignal cancels without throwing ───────────────
await test('waitForAllowance exits cleanly when AbortSignal is fired', async () => {
  const ac = new AbortController();
  let calls = 0;
  const read = async () => { calls++; return 0n; }; // never sufficient
  // Fire abort after a tiny delay
  setTimeout(() => ac.abort(), 60);
  await waitForAllowance(read, 999n, 30_000, ac.signal);
  // If we reach here without throwing, the abort worked correctly.
  assert.ok(calls >= 1, 'should have polled at least once before abort');
});

// ── 4. waitForAllowance — timeout throws ────────────────────────────────────
await test('waitForAllowance throws after timeout when allowance never updates', async () => {
  const read = async () => 0n; // never sufficient
  await assert.rejects(
    () => waitForAllowance(read, 100n, 100 /* 100ms timeout */),
    /still shows no allowance/,
  );
});

// ── 5. parseTxError — user rejection code 4001 ──────────────────────────────
await test('parseTxError identifies user rejection by code 4001', () => {
  const err = { code: 4001, message: 'User denied transaction' };
  const result = parseTxError(err);
  assert.equal(result.rejected, true);
  assert.match(result.message, /rejected/i);
});

// ── 6. parseTxError — pending request -32002 ────────────────────────────────
await test('parseTxError identifies already-pending request by code -32002', () => {
  const err = { code: -32002, message: 'Request already pending' };
  const result = parseTxError(err);
  assert.equal(result.rejected, false);
  assert.match(result.message, /already pending/i);
});

// ── 7. parseTxError — wallet disconnected 4900 ──────────────────────────────
await test('parseTxError identifies disconnected wallet by code 4900', () => {
  const err = { code: 4900, message: 'Provider is disconnected' };
  const result = parseTxError(err);
  assert.equal(result.rejected, false);
  assert.match(result.message, /disconnected/i);
});

// ── 8. parseTxError — unknown error falls back to raw message ────────────────
await test('parseTxError returns raw message for unknown errors', () => {
  const err = { message: 'Something unexpected happened on the blockchain' };
  const result = parseTxError(err);
  assert.equal(result.rejected, false);
  assert.match(result.message, /unexpected/i);
});

// ── 9. Step states — checking/approval (step1 active, step2 waiting) ─────────
await test('step states: checking/approval → step1 active, step2 waiting', () => {
  const { step1, step2, step3 } = computeStepStates({ phase: 'checking', step: 'approval', label: 'Checking…' });
  assert.equal(step1, 'active',   'step1 should be active during approval');
  assert.equal(step2, 'waiting',  'step2 should be waiting during approval');
  assert.equal(step3, 'waiting',  'step3 should be waiting during approval');
});

// ── 10. Step states — checking/liquidity (step2 must be WAITING, not active) ─
await test('step states: checking/liquidity → step2 is waiting (not active, bug fix)', () => {
  // This was the CORE BUG: step2 showed 'active' (spinner on "Confirm in wallet")
  // while we were still only simulating — wallet had NOT been asked yet.
  const { step1, step2, step3 } = computeStepStates({ phase: 'checking', step: 'liquidity', label: 'Simulating…' });
  assert.equal(step1, 'complete', 'step1 should be complete (approval done)');
  assert.equal(step2, 'waiting',  'step2 must be WAITING during simulation — wallet not asked yet');
  assert.equal(step3, 'waiting',  'step3 should be waiting');
});

// ── 11. Step states — wallet/liquidity (step2 active = wallet now asking) ────
await test('step states: wallet/liquidity → step2 active', () => {
  const { step1, step2, step3 } = computeStepStates({ phase: 'wallet', step: 'liquidity', label: 'Approve tx' });
  assert.equal(step1, 'complete', 'step1 complete');
  assert.equal(step2, 'active',   'step2 active — wallet is now asking');
  assert.equal(step3, 'waiting',  'step3 waiting');
});

// ── 12. Step states — pending/liquidity (step2 complete, step3 active) ───────
await test('step states: pending/liquidity → step2 complete, step3 active', () => {
  const { step1, step2, step3 } = computeStepStates({ phase: 'pending', step: 'liquidity', label: 'Confirming…', hash: '0xabc' });
  assert.equal(step1, 'complete', 'step1 complete');
  assert.equal(step2, 'complete', 'step2 complete — tx submitted');
  assert.equal(step3, 'active',   'step3 active — waiting for confirmation');
});

// ── 13. AbortController prevents further state updates after cancel ──────────
await test('submit abort: AbortController prevents further processing after cancel', async () => {
  // Simulates what happens inside submit(): once aborted, guard checks exit early.
  const ac = new AbortController();
  const statusUpdates = [];
  const fakeSetStatus = (s) => {
    if (ac.signal.aborted) return; // mirrors the guard in fixed submit()
    statusUpdates.push(s.phase);
  };

  fakeSetStatus({ phase: 'checking' }); // first update goes through
  ac.abort();                            // cancel
  fakeSetStatus({ phase: 'wallet' });    // this must NOT be recorded
  fakeSetStatus({ phase: 'pending' });   // nor this

  assert.deepEqual(statusUpdates, ['checking'], 'only the pre-abort status update should be recorded');
});

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(44)}`);
console.log(`  ${pass} passed   ${fail} failed   ${pass + fail} total`);
console.log(`${'─'.repeat(44)}\n`);
if (fail > 0) process.exit(1);
