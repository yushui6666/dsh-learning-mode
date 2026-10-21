window.__ModuleLoader__.load({
  id: '@yushui/dsh-learning-mode',
  factory(require) {
    const React = require('react');

    // Every command execution is recorded in the conversation log, so a click
    // is the only thing allowed to run one. The host keeps the authoritative
    // mode in memory per session; this cache lets a re-mounted slot (or a page
    // reload) render the same state without asking again.
    const STORAGE_KEY = 'dsh-learning-mode:state';

    function readState(response) {
      if (response?.ok !== true) throw new Error(response?.error?.message || '无法连接学习模式服务');
      const result = response.value?.result;
      if (result?.kind !== 'success') throw new Error(result?.text || '学习模式插件尚未就绪');
      let state;
      try { state = JSON.parse(result.text); }
      catch { throw new Error('学习模式返回了无效状态'); }
      if (state === null || typeof state !== 'object' || Array.isArray(state) ||
          typeof state.enabled !== 'boolean' || Object.keys(state).length !== 1) {
        throw new Error('学习模式返回了无效状态');
      }
      return state.enabled;
    }

    function readCache() {
      try {
        if (typeof sessionStorage === 'undefined') return {};
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (raw === null) return {};
        const parsed = JSON.parse(raw);
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
        return parsed;
      } catch {
        return {};
      }
    }

    function readSession(sessionId) {
      return readCache()[sessionId] === true;
    }

    function writeSession(sessionId, enabled) {
      try {
        if (typeof sessionStorage === 'undefined') return;
        const cache = readCache();
        cache[sessionId] = enabled;
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
      } catch {}
    }

    function LearningToggle({ ctx, sessionId }) {
      const [state, setState] = React.useState(() => ({
        enabled: readSession(sessionId), loading: false, error: null,
      }));
      const alive = React.useRef(false);
      const busy = React.useRef(false);
      const generation = React.useRef(0);
      const request = React.useCallback(async (action) => {
        if (!alive.current || busy.current) return;
        busy.current = true;
        const ticket = ++generation.current;
        setState((old) => ({ ...old, loading: true, error: null }));
        try {
          const response = await ctx.remote.commands.execute(sessionId, '/learn ' + action, []);
          const enabled = readState(response);
          writeSession(sessionId, enabled);
          if (alive.current && ticket === generation.current) setState({ enabled, loading: false, error: null });
        } catch (error) {
          if (alive.current && ticket === generation.current) {
            setState((old) => ({ ...old, loading: false, error: error instanceof Error ? error.message : String(error) }));
          }
        } finally {
          if (ticket === generation.current) busy.current = false;
        }
      }, [ctx, sessionId]);

      React.useEffect(() => {
        alive.current = true;
        const forget = () => {
          if (!alive.current) return;
          generation.current++;
          busy.current = false;
          writeSession(sessionId, false);
          setState({ enabled: false, loading: false, error: null });
        };
        const reset = ctx.on('connection/reset', forget);
        return () => {
          alive.current = false;
          generation.current++;
          busy.current = false;
          reset();
        };
      }, [ctx, sessionId]);

      const title = state.error ? state.error + '；点击重试' :
        state.loading ? '正在同步学习模式' : state.enabled ?
          '学习模式已开启；点击关闭，从下一次模型请求起生效' :
          '开启学习模式：知识引入、交互学习、测试与反馈；不会自动刷新状态';
      return React.createElement('button', {
        type: 'button', className: 'dsh-learning-mode-toggle',
        'data-learning-mode': true,
        'aria-label': state.error ? '重试学习模式' : '学习模式',
        'aria-pressed': state.enabled,
        'aria-busy': state.loading,
        title, disabled: state.loading,
        onClick: () => { void request(state.error ? 'status' : state.enabled ? 'off' : 'on'); },
      },
      React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, 'aria-hidden': true },
        React.createElement('path', { d: 'M12 5v15M3 4.5c3-1 6-1 9 1 3-2 6-2 9-1V19c-3-1-6-1-9 1-3-2-6-2-9-1Z', strokeLinejoin: 'round' })),
      React.createElement('span', null, state.error ? '重试学习' : '学习模式'));
    }

    function LearningSlot(props) {
      return props.available ? React.createElement(LearningToggle, { ...props, key: props.sessionId }) : null;
    }

    const inject = ['slots', 'sessions', 'remote', 'remote.commands'];
    function apply(ctx) {
      ctx.effect(() => {
        const style = document.createElement('style');
        style.dataset.plugin = 'dsh-learning-mode';
        style.textContent = '.dsh-learning-mode-toggle{box-sizing:border-box;display:inline-flex;flex:none;align-items:center;gap:5px;height:28px;padding:0 8px;border:0;border-radius:var(--dsw-radius-sm,8px);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;line-height:20px;white-space:nowrap;cursor:pointer}.dsh-learning-mode-toggle:hover:not(:disabled){background:var(--dsw-alias-interactive-hover,rgba(128,128,128,.12))}.dsh-learning-mode-toggle[aria-pressed=true]{background:var(--dsw-alias-state-business-tertiary);color:var(--dsw-alias-state-business-primary)}.dsh-learning-mode-toggle:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}.dsh-learning-mode-toggle:disabled{cursor:wait;opacity:.6}';
        document.head.appendChild(style);
        return () => style.remove();
      }, 'learning-mode: toolbar style');
      ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
        name: 'conversation.input.left', id: 'learning-mode', order: 25,
        inject: (sessionId) => ({
          ctx, sessionId, available: ctx.sessions.subagentAddress(sessionId) === undefined,
        }),
      }, LearningSlot));
    }
    return { apply, inject, readState };
  },
});
