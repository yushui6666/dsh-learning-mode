import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

let client;
vm.runInNewContext(readFileSync(new URL('../client.js', import.meta.url), 'utf8'), {
  window: { __ModuleLoader__: { load({ factory }) { client = factory(() => ({})); } } },
});
const response = (value) => ({ ok: true, value: { result: { kind: 'success', text: JSON.stringify(value) } } });

test('client reads host-confirmed on/off rather than guessing from a click', () => {
  assert.equal(client.readState(response({ enabled: true })), true);
  assert.equal(client.readState(response({ enabled: false })), false);
});

test('transport errors, unknown command and command errors cannot report success', () => {
  for (const value of [undefined, { ok: false, error: { message: 'offline' } },
    { ok: true }, { ok: true, value: { result: { kind: 'error', text: 'denied' } } }]) {
    assert.throws(() => client.readState(value));
  }
});

test('malformed host data is rejected at the transport boundary', () => {
  for (const value of [null, {}, { enabled: 'false' }, { enabled: 1 }, [], { enabled: true, unexpected: 1 }]) {
    assert.throws(() => client.readState(response(value)));
  }
  assert.throws(() => client.readState({ ok: true, value: { result: { kind: 'success', text: 'not json' } } }));
});
