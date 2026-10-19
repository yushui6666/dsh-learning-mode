import test from 'node:test';
import assert from 'node:assert/strict';
import { apply } from '../index.js';

// Exercise our registered command and section, not host framework internals.
function fixture() {
  let command, section;
  const changes = [];
  apply({
    commands: { register(value) { command = value; } },
    systemPrompt: {
      getSectionOrder() { return 9900; },
      section(value) { section = value; },
    },
    emit(event) { changes.push(event); },
  });
  const session = {};
  const agent = { session };
  return {
    agent, section, changes,
    command: (rawInput, target = agent) => command.handler({ agent: target, rawInput }),
    prompt: (target = agent) => section.text({ agent: target }),
  };
}

test('default off; enabling injects teaching guidance only into the selected session', () => {
  const f = fixture();
  assert.equal(f.prompt(), '');
  assert.deepEqual(JSON.parse(f.command('status').text), { enabled: false });
  assert.deepEqual(JSON.parse(f.command('on').text), { enabled: true });
  assert.ok(f.prompt().length > 500, 'enabled session receives the actual teaching guidance');
  assert.equal(f.prompt({ session: {} }), '');
  assert.equal(f.section.text({}), '');
});

test('off stops future injection and does not modify another enabled session', () => {
  const f = fixture();
  const other = { session: {} };
  f.command('on');
  f.command('on', other);
  f.command('off');
  assert.equal(f.prompt(), '');
  assert.ok(f.prompt(other).length > 500);
});

test('status and repeated selections are idempotent; invalid input preserves state', () => {
  const f = fixture();
  f.command('on');
  const text = f.prompt();
  for (const input of ['on', 'status', '', '  status  ']) {
    assert.equal(f.command(input).kind, 'success');
    assert.equal(f.prompt(), text);
  }
  for (const input of ['ON', 'toggle', 'on extra', null, 42]) {
    assert.equal(f.command(input).kind, 'error');
    assert.equal(f.prompt(), text);
  }
  f.command('off');
  f.command('off');
  assert.equal(f.prompt(), '');
});

test('missing session context returns an error instead of enabling globally', () => {
  const f = fixture();
  for (const agent of [undefined, {}, { session: null }]) {
    // Pass the invocation directly to avoid fixture default arguments.
    let command;
    apply({ commands: { register(v) { command = v; } },
      systemPrompt: { getSectionOrder: () => 9900, section() {} }, emit() {} });
    assert.equal(command.handler({ agent, rawInput: 'on' }).kind, 'error');
  }
  assert.equal(f.section.text({}), '');
});

test('new plugin instance and new session object never restore old mode', () => {
  const first = fixture();
  first.command('on');
  const second = fixture();
  assert.equal(second.prompt(first.agent), '');
  assert.equal(first.prompt({ session: { id: first.agent.session.id } }), '');
});
