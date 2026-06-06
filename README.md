# Vibe--Agent-Office-
The code may be cold, but the development experience should be warm. We have turned the tedious API key management into a ceremonial feeling like putting a badge on a new employee. This is not only a tool, but also a geek romance for our future collaborative work.
# Agent 办公室

一张办公桌,三个 AI 员工(前端 / 后端 / 测试)。
点击工牌编辑模型与 API Key,直接落盘到 `config.json`;给三人小组下一个任务,他们会**串行协作**完成。

![chibi office](assets/scene/office-bg.png)

## 特性

- **像素办公室**:静态背景图 + 三个透明角色立绘,工牌挂胸前
- **工牌即配置**:点击工牌弹出编辑框,改模型/Key/API 地址,保存后写入 `config.json`
- **三人串行 SOP**:后端设计 API → 前端写 UI → 测试给用例与 bug 提醒
- **流式输出**:每个员工的回答实时打字进头顶气泡,点气泡进抽屉看全文
- **多渠道兼容**:支持 Anthropic 官方,也支持中转(OpenAI-Next、OneAPI 等)

## 技术栈

| 层 | 选择 |
|---|---|
| 后端 | Node.js + Express(SSE 推送流式输出) |
| 前端 | 原生 HTML / CSS / 少量 JS,无构建步骤 |
| 模型 | `@anthropic-ai/sdk`,通过 `baseURL` 参数支持中转 |
| 配置 | 单一 `config.json`,工牌点击直接落盘 |

## 运行环境

只需 **Node.js 18+**,无其他依赖。

```bash
node --version   # 期望 v18 或更高
```

## 快速开始

```bash
# 1. 克隆 + 装依赖
git clone <your-repo-url> agent-office
cd agent-office
npm install

# 2. 准备配置(从示例复制,填上你自己的 Key)
cp config.example.json config.json

# 3. 启动
npm start
# 控制台输出:Agent 办公室 → http://localhost:3000

# 4. 浏览器打开
open http://localhost:3000
```

> ⚠️ **必须用 `http://localhost:3000` 访问,不要双击 HTML**。
> 双击 HTML 会以 `file://` 协议打开,无法访问后端 API,会出现 "Failed to fetch"。

## 配置 API Key

打开页面后,点击任意员工胸前的**工牌**,在弹出框中填:

| 字段 | 说明 |
|---|---|
| 模型名称 | 例如 `claude-sonnet-4-6`、`claude-opus-4-7`,**取决于你的 Key 渠道支持哪些模型** |
| API Key | `sk-ant-...` 或中转商签发的 Key |
| API 地址 | 留空 = 走 Anthropic 官方;用中转就填中转地址,例如 `https://api.openai-next.com` |

保存后 Key 会写入 `config.json`(已加入 `.gitignore`,不会被 commit)。

## 给三人小组派任务

页面底部输入框写一个需求,例如:

> 做一个待办清单的小应用

点 **开工**,顺序如下:

1. **后端工程师** 先发言:输出 RESTful API 列表 + 核心数据结构
2. **前端工程师** 看到后端的设计后:输出可运行的单文件 HTML(含 fetch 调用)
3. **测试工程师** 看到前两位的产出后:输出测试用例 + 潜在 bug

每个员工头顶冒出气泡,**点击气泡**进入右侧抽屉看完整内容。

## 项目结构

```
agent-office/
├── server.js              # Express 后端 + SSE 流水线
├── agents.js              # 三个角色的 system prompt
├── index.html             # 主页面
├── styles.css             # 像素 + 现代毛玻璃混搭样式
├── app.js                 # 工牌交互、SSE 客户端、抽屉
├── config.example.json    # 配置模板(Key 留空,可提交)
├── config.json            # 真实配置(.gitignore 排除,不可提交)
├── package.json
└── assets/
    ├── characters/
    │   ├── frontend.png   # 前端 - 长发女员工
    │   ├── backend.png    # 后端 - 西装男
    │   └── tester.png     # 测试 - 眼镜男
    └── scene/
        └── office-bg.png  # 办公室背景(三工位)
```

## 接口一览

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET`  | `/api/config` | 读取所有员工配置 |
| `POST` | `/api/config/:agentId` | 保存某员工的 model / apiKey / baseURL |
| `POST` | `/api/chat/:agentId` | 单 agent 对话(非流式) |
| `GET`  | `/api/run?task=...` | 三人协作 SOP,SSE 流式推送 |

SSE 事件类型:`start` / `agent_start` / `agent_delta` / `agent_done` / `agent_error` / `end`

## 安全提示

- `config.json` **必须** 加到 `.gitignore`(本仓库已配置),否则误推 GitHub 会泄露 Key
- 本项目仅用于本地自用 / 内部演示,**未做鉴权**,请勿暴露到公网
- 想要更安全:可改用 OS Keychain(macOS Keychain / Windows Credential Manager),`config.json` 只存模型名

## 兼容性说明

不同模型渠道支持的能力不同:

| 渠道 | 流式 streaming | Anthropic 协议 | 备注 |
|---|---|---|---|
| Anthropic 官方 | ✅ | ✅ | 直连最稳,留空 baseURL |
| OpenAI-Next 等中转 | ⚠️ 视实现 | ⚠️ 视实现 | 部分中转只支持 OpenAI 协议,需在 SOP 里改用 `openai` SDK |
| OneAPI / new-api | ⚠️ | ⚠️ | 同上 |

如果点 "开工" 后报 `404 unknown route` 或 `unsupported model`,基本是**模型名**和你的渠道对不上,改工牌上的模型名重试。

## Roadmap

- [ ] 支持 OpenAI 协议(给只支持 OpenAI 的中转用)
- [ ] agent 产出的代码自动写入 `workspace/` 目录
- [ ] 多轮迭代:测试发现 bug → 回到前端/后端修
- [ ] 持久化任务历史
- [ ] 用 OS Keychain 存 API Key,`config.json` 只留模型名

## License

MIT
