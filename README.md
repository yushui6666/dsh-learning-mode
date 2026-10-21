# 学习模式 · dsh-learning-mode

输入框工具栏的「学习模式」开关：打开后为**当前会话**注入一套固定教学提示词——问题引入 → 讲解与交互探索 → 测试 → 反馈纠错。测验、参数滑块、交卷判分都由 GenUI 直接画在回答里，点选即时出结果，判分不发模型请求。

> Learning Mode for DeepSeek Harness: a toggle next to the input box that injects a teaching prompt into the current session (introduce the idea, teach it, test it, correct it) and renders quizzes, sliders and local grading through GenUI. No course library, no progress storage, no extra pages.

## 长什么样

学习模式本身不画界面。它负责的是"教什么、什么时候停、什么时候反馈"，画面交给 **GenUI** 渲染。
下面三张不是设计稿，是同一套渲染器实时画出来的真实组件：

**单题测验：点选即判，选错了也有针对该选项的解释**

![单题测验](https://raw.githubusercontent.com/yushui6666/dsh-learning-mode/main/docs/assets/quiz.png)

**交卷判分：三题一起交，分数、每题对错和解析当场出现（全部在浏览器里算）**

![交卷判分](https://raw.githubusercontent.com/yushui6666/dsh-learning-mode/main/docs/assets/paper.png)

**参数探索：先猜结论，再拖滑块看曲线怎么变**

![参数探索](https://raw.githubusercontent.com/yushui6666/dsh-learning-mode/main/docs/assets/plot.png)

开关本身在输入框工具栏左侧，是一个小图标按钮：点亮＝本会话已开启，再点一次关闭。

## 一次完整的学习循环

| 阶段 | 你做什么 | 插件和模型做什么 |
| --- | --- | --- |
| 引入 | 说一句想学什么，比如「我想学概率，从条件概率开始」 | 用一个真实问题引出为什么值得学，并说明这轮学完能做到什么 |
| 学习 | 看解释、跟着预测、拖滑块验证 | 直觉解释 → 具体例子 → 准确术语或公式；只在值得动手的地方安排探索 |
| 测试 | 点选项、或把几题都选完点「交卷」 | GenUI 本地判分：对错、解析、得分立刻显示，不额外请求模型 |
| 反馈 | 说哪里没懂，或点「继续学习」「换个例子」 | 针对具体误区换反例重讲，再给一道等价题确认 |

### 哪些交互留在本地，哪些会回到模型

- **纯本地**：判题、交卷打分、拖滑块、展开与切换——浏览器即时完成，不产生请求。
- **会回传**：带 `action` 的单题测验、带 `groups` 的交卷按钮、以及「换个例子」「再讲一遍」「继续学习」这类按钮，会以 `[genui-action]` 把真实作答与选择送回模型，模型据此补讲或推进。
- 分界由内置提示词约束：没有真实提交时，模型不会声称看到了分数或选择。

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

插件市场里搜「学习模式」即可；或命令行一次装齐（两条命令，按顺序执行，各自只装一个插件）：

```sh
dsh plugin --profile web add @changfenhuang/dsh-genui
dsh plugin --profile web add @yushui/dsh-learning-mode
```

第一条是渲染器（见上节），第二条才是本插件。已经装过 GenUI 的跳过第一条即可。

### 这两条命令是什么，不是什么

- 是宿主自带的插件管理器：等价于在市场里点两次「安装」，装到本机 profile 的 `node_modules` 并登记进 `dsh.profile.bundles`。
- 不是 `curl … | sh` 之类的远程脚本：命令不下载执行任何安装脚本，包本身也没有 `postinstall` / `preinstall` / `prepare`，只有 `prepack`（`node --check` 语法检查，只在打包时跑）。`pnpm` 默认也不执行依赖的构建脚本。
- 想撤销：在插件市场里点卸载（推荐，会同时清掉 `dsh.profile.bundles` 里的登记）；也可以用 `dsh plugin --profile web remove <包名>`，若那行登记还在，手动删掉即可。

## 使用

打开或新建一个会话，点击输入框工具栏的「学习模式」，确认按钮高亮。输入「我想学概率，先从条件概率开始」等主题即可。关闭后，从下一次模型请求起不再加入这套提示词，历史对话仍保留。

学习模式不替代 GenUI，不创建其他网页，不改变模型或权限。

## 生命周期

默认关闭；不同会话互不影响。按钮只在点击时执行一次 `/learn on|off`，把宿主确认后的状态记在当前窗口的 sessionStorage 里；页面刷新沿用该记录，不再自动向宿主查询——因此不会在会话流里凭空多出命令记录。宿主重启或插件重载会回到关闭。没有课程库或学习进度持久化，插件也不会从日志恢复开关。

## 内置提示词

教学规则位于 `prompt.js`。每次只教一个完整小节，保留真实动手与等待作答的环节，不伪造成绩；要求模型先讲"观察什么、操作什么"，再给组件。滑块与本地判题由 GenUI 完成，需要模型补讲时才使用 action。

**兜底**：如果用户说看不到组件、按钮点不了，或者只看到一段代码/JSON，提示词要求模型从下一条回复起改用文字、列表和表格把同一份内容讲完，并且不再输出围栏。所以在没有渲染器的环境里，教学不会断在半截 JSON 上。

## 开发

无运行时 npm 依赖的原生 JavaScript 插件：`index.js` 是宿主入口（注册 `/learn` 命令与 system-prompt 段落），`client.js` 是宿主 ModuleLoader 直接可用的浏览器包，不需要额外转译。使用 `conversation.input.left`、`remote.commands`、`systemPrompt` 接口；客户端不 require GenUI 的任何模块，因此 `dsh.client.inject` 只列宿主包，dsh-ui 的渲染完全由 GenUI 自己的围栏渲染器接管。

```sh
npm test      # 14 项测试：命令/提示词生命周期 + 客户端交互
npm run build # 逐个检查原生 JS 语法
npm pack
```

高级备用命令：`/learn on`、`/learn off`、`/learn status`。返回 JSON 状态且不启动模型生成；按钮平时不调用它们，只在点击（或点击重试）时执行一次，因此每次都会在会话流留下一条命令记录。

`docs/assets/` 里的截图由 GenUI 的独立渲染器（`standalone-runtime.js`）渲染同一份 `dsh-ui` 规格后截取，与聊天里看到的组件同源。

## 边界

本地判卷不自动等于模型收到错题；提示词要求模型在收到真实提交或用户说明后再反馈。教学质量和组件选择仍依赖所用模型与 GenUI 能力，本插件不保证任意模型都能正确讲解任意学科。

## 安全边界

代码只用宿主公开接口：服务端注册 `/learn` 命令与一段 system prompt，客户端只做一次 `remote.commands.execute(sessionId, "/learn on|off")` 和 `sessionStorage` 读写。

- 不联网：没有任何 `fetch` / `http` 请求，不连第三方服务。
- 不读写用户文件：服务端与客户端都不 import `fs`（`test/` 里的测试读自身源码除外）。
- 不执行子进程、不 `eval`，仓库里没有二进制和压缩代码。
- 不收集数据：没有遥测、没有上报，状态只存在当前窗口的 `sessionStorage`。
- 安装期不跑脚本：见上方「这两条命令是什么，不是什么」。

## 许可

MIT
