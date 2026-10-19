import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { setImmediate as tick } from 'node:timers/promises';

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8');

function storage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
  };
}

// Only the React/host boundaries are substituted; request handling is the shipped source.
function mount(execute, { sessionStorage = storage(), sessionId = 'session-a' } = {}) {
  let plugin, registration, Component, state, cursor = 0, mounted = false;
  const refs = [], effects = [], cleanups = [], events = new Map();
  const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: (initial) => {
      if (state === undefined) state = typeof initial === 'function' ? initial() : initial;
      return [state, (update) => { state = typeof update === 'function' ? update(state) : update; }];
    },
    useRef: (initial) => refs[cursor++] ?? (refs[cursor - 1] = { current: initial }),
    useCallback: (fn) => fn,
    useEffect: (fn) => { if (!mounted) effects.push(fn); },
  };
  const listen = (name, fn) => { events.set(name, fn); return () => events.delete(name); };
  const ctx = {
    effect() {}, on: listen,
    sessions: { subagentAddress: () => undefined },
    remote: { commands: { execute } },
    slots: { inject(_name, fn) { fn(); }, register(options, component) { registration = options; Component = component; } },
  };
  vm.runInNewContext(source, {
    window: { __ModuleLoader__: { load({ factory }) { plugin = factory(() => React); } } },
    sessionStorage,
  });
  plugin.apply(ctx);
  const element = Component(registration.inject(sessionId));
  const render = () => { cursor = 0; return element.type(element.props); };
  render();
  mounted = true;
  for (const effect of effects) cleanups.push(effect());
  return {
    render,
    click: () => render().props.onClick(),
    event: (name) => events.get(name)?.(),
    has: (name) => events.has(name),
    dispose: () => cleanups.forEach((fn) => fn()),
  };
}
const reply = (enabled) => ({ ok: true, value: { result: { kind: 'success', text: JSON.stringify({ enabled }) } } });

test('mounting renders without running any command, from the remembered state', () => {
  const requests = [];
  const ui = mount(async (_id, line) => { requests.push(line); return reply(true); });
  assert.deepEqual(requests, [], 'a mount must not append a command to the conversation log');
  assert.equal(ui.render().props['aria-pressed'], false);
  assert.equal(ui.has('focus'), false, 'window focus must not be watched');
  ui.dispose();

  const store = storage();
  store.setItem('dsh-learning-mode:state', JSON.stringify({ 'session-a': true }));
  const remembered = mount(async () => { throw new Error('must not run'); }, { sessionStorage: store });
  assert.equal(remembered.render().props['aria-pressed'], true);
  remembered.dispose();
});

test('a click runs only the toggle command and adopts the host answer', async () => {
  const requests = [];
  let on = false;
  const ui = mount(async (_id, line) => { requests.push(line); on = line === '/learn on'; return reply(on); });
  ui.click();
  await tick();
  assert.deepEqual(requests, ['/learn on']);
  assert.equal(ui.render().props['aria-pressed'], true);
  ui.click();
  await tick();
  assert.deepEqual(requests, ['/learn on', '/learn off']);
  assert.equal(ui.render().props['aria-pressed'], false);
  ui.dispose();
});

test('a connection reset forgets the mode without running a status query', async () => {
  const requests = [];
  const ui = mount(async (_id, line) => { requests.push(line); return reply(true); });
  ui.click();
  await tick();
  assert.equal(ui.render().props['aria-pressed'], true);
  ui.event('connection/reset');
  assert.equal(ui.render().props['aria-pressed'], false, 'an unknown server lifetime must read as off, never as on');
  assert.deepEqual(requests, ['/learn on'], 'resetting state must not add a command record');
  ui.dispose();
});

test('unmount cancels the pending click and ignores its response', async () => {
  let resolveFirst, calls = 0;
  const ui = mount(async () => { calls++; return new Promise((resolve) => { resolveFirst = resolve; }); });
  ui.click();
  ui.dispose();
  resolveFirst(reply(true));
  await tick();
  assert.equal(calls, 1);
  assert.equal(ui.render().props['aria-pressed'], false);
});

test('a transport failure offers a retry that asks the host once', async () => {
  let fail = true;
  const requests = [];
  const ui = mount(async (_id, line) => {
    requests.push(line);
    if (fail) throw new Error('connection lost');
    return reply(false);
  });
  ui.click();
  await tick();
  assert.equal(ui.render().props['aria-label'], '重试学习模式');
  assert.equal(ui.render().props['aria-pressed'], false);
  fail = false;
  ui.click();
  await tick();
  assert.deepEqual(requests, ['/learn on', '/learn status']);
  assert.equal(ui.render().props['aria-label'], '学习模式');
  assert.equal(ui.render().props.disabled, false);
  ui.dispose();
});

test('a remembered click survives a remount without a second command', async () => {
  const sessionStorage = storage();
  const requests = [];
  const execute = async (_id, line) => { requests.push(line); return reply(line === '/learn on'); };
  const first = mount(execute, { sessionStorage });
  first.click();
  await tick();
  first.dispose();
  assert.deepEqual(requests, ['/learn on']);
  const second = mount(execute, { sessionStorage });
  assert.equal(second.render().props['aria-pressed'], true);
  assert.deepEqual(requests, ['/learn on']);
  second.dispose();
});
