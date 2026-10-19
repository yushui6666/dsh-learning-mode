import { TEACHING_PROMPT } from './prompt.js';

export const name = 'learning-mode';
export const inject = ['commands', 'systemPrompt'];

export function apply(ctx) {
  const enabled = new WeakSet();
  ctx.systemPrompt.section({
    name: 'learning-mode:teaching',
    order: ctx.systemPrompt.getSectionOrder('STRUCTURED_OUTPUT') + 1,
    interpolate: false,
    text: ({ agent }) => enabled.has(agent?.session) ? TEACHING_PROMPT : '',
  });
  ctx.commands.register({
    definitionId: 'dsh-learning-mode:learn',
    name: 'learn',
    description: '开启或关闭当前会话的 GenUI 交互式学习模式',
    input: { hint: 'on|off|status' },
    handler: ({ agent, rawInput }) => {
      const session = agent?.session;
      if (session === null || typeof session !== 'object') {
        return { kind: 'error', text: '学习模式需要一个有效的当前会话。' };
      }
      if (typeof rawInput !== 'string') {
        return { kind: 'error', text: '用法：/learn on、/learn off 或 /learn status。' };
      }
      const action = rawInput.trim() || 'status';
      if (!['on', 'off', 'status'].includes(action)) {
        return { kind: 'error', text: '用法：/learn on、/learn off 或 /learn status。' };
      }
      const before = enabled.has(session);
      if (action === 'on') enabled.add(session);
      if (action === 'off') enabled.delete(session);
      if (before !== enabled.has(session)) ctx.emit('system-prompt/change');
      return { kind: 'success', text: JSON.stringify({ enabled: enabled.has(session) }) };
    },
  });
}
