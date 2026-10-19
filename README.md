# 学习模式 · dsh-learning-mode

输入框工具栏左侧的「学习模式」开关：打开后为**当前会话**注入一套固定教学提示词——实际问题引入 → 分知识点讲解/交互探索 → 测试 → 反馈与纠错，测验与滑块由 GenUI 渲染成可点的组件，本地判分不额外调用模型。

> Learning Mode for DeepSeek Harness: a toggle next to the input box that injects a teaching prompt into the current session (introduce the idea, teach it, test it, correct it) and renders graded quizzes through GenUI. No course library, no progress storage, no extra pages.

## 前置条件：先装 GenUI（必装）

本插件只负责"教什么"，画面交给 **GenUI** 渲染。它不是一个库，而是另一个独立插件，必须单独安装：

| | |
| --- | --- |
| npm 包 | `@changfenhuang/dsh-genui` |
| 源码仓库 | [omdsh-dev/dsh-genui](https://github.com/omdsh-dev/dsh-genui) |
| 许可 | MIT |
| 插件市场里 | 搜 `dsh-genui`，作者 `omdsh-dev`，分类 ui |
| 本插件实测版本 | `0.12.0`（市场当前已到 `0.13.0`） |

安装（市场里点安装，或命令行）：

```sh
dsh plugin --profile web add @changfenhuang/dsh-genui
```

> ⚠️ 市场里有三个名字相近的插件，只有第一个是本插件依赖的那个：
> - `@changfenhuang/dsh-genui`（作者 omdsh-dev）✅ 本插件需要的就是它
> - `dsh-genui`（作者 lhuans，OpenTiny / schemaJson 路线）❌ 不兼容
> - `dsh-plugin-genui`（作者 pengyue-polaron，React 任务应用）❌ 不兼容

**怎么确认真的生效**：插件装好后，profile 的 `dsh.profile.bundles` 里会出现 `@changfenhuang/dsh-genui`；刷新客户端后，让它输出一段 ```dsh-ui 代码块——能渲染成卡片/测验即为生效。

**没装 GenUI 会怎样**：按钮照常可用，提示词照常注入，但 `dsh-ui` 围栏只会显示成一段原始代码块——测验点不了、滑块拖不动、本地判分不存在，教学退化成纯文字问答。所以这是"必装前置"，不是可选项。

**为什么本插件不把 GenUI 打进包里**：GenUI 安装后是 215 个文件 / 8.5 MB，自带宿主入口、浏览器渲染器和 katex / mermaid / three / echarts 资产。DSH 只加载 profile `bundles` 列表里的插件——把它写成我们的 `dependencies` 只会让 pnpm 多下一份，却不会被注册成 bundle，渲染器依然不工作，还可能和用户已装的版本互相打架。因此两个插件各自安装、各自升级；`package.json` 里只用 `peerDependencies`（`optional`）说明这层关系，不参与安装。

## 安装

插件市场里搜「学习模式」即可；或命令行：

```sh
dsh plugin --profile web add @yushui/dsh-learning-mode
```

## 使用

打开或新建一个会话，点击输入框下方「学习模式」，确认按钮高亮。输入「我想学概率，先从条件概率开始」等主题即可。关闭后，从下一次模型请求起不再加入这套提示词，历史对话仍保留。

学习模式不替代 GenUI，不创建其他网页，不改变模型或权限。

## 生命周期

默认关闭；不同会话互不影响。按钮只在点击时执行一次 `/learn on|off`，把宿主确认后的状态记在当前窗口的 sessionStorage 里；页面刷新沿用该记录，不再自动向宿主查询——因此不会在会话流里凭空多出命令记录。宿主重启或插件重载会回到关闭。没有课程库或学习进度持久化，插件也不会从日志恢复开关。

## 内置提示词

教学规则位于 `prompt.js`。每次只教一个完整小节，保留真实动手与等待作答的环节，不伪造成绩。滑块与本地判题由 GenUI 完成，需要模型补讲时才使用 action。

## 开发

无运行时 npm 依赖的原生 JavaScript 插件：`index.js` 是宿主入口（注册 `/learn` 命令与 system-prompt 段落），`client.js` 是宿主 ModuleLoader 直接可用的浏览器包，不需要额外转译。使用 `conversation.input.left`、`remote.commands`、`systemPrompt` 接口；客户端不 require GenUI 的任何模块，因此 `dsh.client.inject` 只列宿主包，dsh-ui 的渲染完全由 GenUI 自己的围栏渲染器接管。

```sh
npm test      # 14 项测试：命令/提示词生命周期 + 客户端交互
npm run build # 逐个检查原生 JS 语法
npm pack
```

高级备用命令：`/learn on`、`/learn off`、`/learn status`。返回 JSON 状态且不启动模型生成；按钮平时不调用它们，只在点击（或点击重试）时执行一次，因此每次都会在会话流留下一条命令记录。

## 边界

本地判卷不自动等于模型收到错题；提示词要求模型在收到真实提交或用户说明后再反馈。教学质量和组件选择仍依赖所用模型与 GenUI 能力，本插件不保证任意模型都能正确讲解任意学科。

## 许可

MIT
