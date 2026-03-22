# Minecraft Chat Bot

一个功能强大的 Minecraft 聊天机器人，支持多款 AI 模型（Deepseek、Gemini、ChatGPT、Grok、Claude），具备自动重连、私聊回复、防刷屏分段发送、管理员命令执行、Token 统计、Web 管理界面、CDK 兑换、**QQ 互通**等特性。通过 Python 启动器一键运行，无需手动安装 Node 依赖。

## ✨ 功能特性

- **多 AI 模型支持**  
  通过简单的命令前缀切换模型（如 `#deepseek`、`#gemini`、`#chatgpt`、`#grok`、`#claude`），每个模型均可独立配置 API 密钥、端点、路径和模型名称。

- **自动重连**  
  与服务器意外断开后，自动尝试重新连接（可配置重连延迟和最大尝试次数），登录成功时重置计数。

- **私聊回复**  
  支持通过 `/msg` 或 `/tell` 悄悄与机器人对话，机器人会以私聊方式回复（命令执行除外）。

- **防刷屏分段发送**  
  长回复自动按行分割发送，每行之间可配置延迟（默认 600ms），有效避免服务器反刷屏插件踢出。

- **管理员命令执行**  
  当发送者为游戏内管理员（`ADMIN_NAME`）时，强制要求 AI 返回 JSON 格式的命令数组，机器人自动解析并执行（命令公开执行，聊天部分保持原回复方式）。

- **机器人管理员系统**  
  设置 `BOT_ADMIN` 后，可使用 `#ban`、`#unban`、`#banlist` 命令管理黑名单，禁止特定玩家使用 AI。

- **CDK 兑换系统**  
  游戏内管理员可通过 `#addCDK` 生成兑换码（可关联多条命令，支持 `{}` 占位符），玩家通过 `#useCDK` 兑换并执行命令，适合发放奖励、权限等。

- **Token 使用统计**  
  每次调用记录 token 消耗和调用次数，退出时打印汇总统计。

- **初始化动作**  
  可设置机器人登录后立即执行的聊天内容（例如 `/login password`）。

- **Web 管理界面**  
  内置网页配置工具，通过浏览器即可：
  - 编辑 `.env` 配置文件（实时生效）。
  - 查看服务器日志（支持分页、搜索、下载、清空）。
  - 远程发送聊天消息或执行游戏命令（如 `/kill`、`/give`）。
  - 支持可选的 Basic 认证（用户名/密码通过环境变量设置）。

- **QQ 互通**  
  通过 **NapCat** 实现 Minecraft 与 QQ 群的双向消息同步：
  - 游戏内公开聊天（不含 AI 指令）自动转发到 QQ 群。
  - QQ 群消息（纯文本）自动在游戏内显示。
  - 支持过滤机器人自己的消息，避免循环。
  - 支持图文混排，仅转发文本部分，纯图片/表情自动忽略。

## 📦 安装

### 环境要求
- Python 3.6 或更高版本
- Node.js (v14 或更高，附带 npm)

### 安装依赖
无需手动操作，Python 启动器会在首次运行时自动执行 `npm install`（如果失败，请手动运行 `npm install`）。

## ⚙️ 配置

所有配置均通过环境变量进行。请复制 `.env.example` 文件，重命名为 `.env`，并填写你的配置。启动器会自动加载该文件。

### 基础 Minecraft 配置
| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `MC_HOST` | 服务器地址 | `localhost` |
| `MC_PORT` | 服务器端口 | `25565` |
| `MC_USERNAME` | 机器人用户名 | `DeepBot` |
| `MC_INITIAL_ACTION` | 登录后立即执行的聊天内容 | 空 |
| `ADMIN_NAME` | 游戏内管理员（可让 AI 执行命令） | 空 |
| `BOT_ADMIN` | 机器人管理员（可执行封禁命令） | 空 |

### AI 模型配置
每个模型均支持以下变量（以 `DEEPSEEK_` 为例）：

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `{MODEL}_API_KEY` | API 密钥 | 空（未设置时禁用该模型） |
| `{MODEL}_ENDPOINT` | API 基础地址 | 官方地址（见下表） |
| `{MODEL}_PATH` | API 路径 | `/v1/chat/completions` |
| `{MODEL}_MODEL` | 模型名称 | 见下表 |
| `{MODEL}_PREFIX` | 触发前缀（注意末尾空格） | `#{小写模型名} ` |

#### 各模型默认值
| 模型 | 默认 ENDPOINT | 默认 MODEL |
|------|---------------|------------|
| Deepseek | `https://api.deepseek.com` | `deepseek-reasoner` |
| Gemini | `https://generativelanguage.googleapis.com` | `gemini-pro` |
| ChatGPT | `https://api.openai.com` | `gpt-3.5-turbo` |
| Grok | `https://api.x.ai` | `grok-1` |
| Claude | `https://api.anthropic.com` | `claude-3-opus-latest` |

### Web 管理配置
| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `WEB_PORT` | Web 管理界面端口 | `3000` |
| `WEB_USERNAME` | 访问用户名（留空则无需认证） | 空 |
| `WEB_PASSWORD` | 访问密码 | 空 |

### 防刷屏配置
| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `CHAT_DELAY_MS` | 行间发送延迟（毫秒） | `600` |

### QQ 互通配置
| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `NAPCAT_API` | NapCat HTTP API 地址 | `http://127.0.0.1:3000` |
| `QQ_GROUP_ID` | 要互通的 QQ 群号 | 空 |
| `BOT_QQ` | 机器人 QQ 号（用于过滤自己） | 空 |
| `BRIDGE_URL` | 桥接服务接收消息的地址 | `http://127.0.0.1:82/api/mc-message` |
| `BRIDGE_PORT` | 桥接服务监听端口 | `82` |

## 🚀 运行

### 使用 Python 启动器（推荐）
在项目根目录执行：
```bash
python main.py
```
启动器会自动：
- 检查 Node.js 环境
- 加载 `.env` 文件中的环境变量
- 同时启动 Minecraft 机器人（`bot.js`）、Web 管理界面（`web.js`）和 QQ 桥接服务（`qq-bridge.js`）

### 访问 Web 管理界面
启动后，打开浏览器访问 `http://你的服务器公网IP:3000`（端口可在 `.env` 中自定义）。  
如果设置了 `WEB_USERNAME` 和 `WEB_PASSWORD`，需要输入用户名密码才能进入。  
- 主页（`/`）：配置编辑器，可修改所有环境变量。
- 日志查看（`/logs`）：查看服务器日志，支持分页、搜索、下载、清空。
- 远程控制（`/control`）：发送聊天消息或执行游戏命令。

### 停止
按 `Ctrl+C` 即可终止所有进程，启动器会正确处理退出并打印 Token 统计。

## 🎮 使用方法

### 公开聊天
在游戏内直接发送以模型前缀开头的消息：
```
#deepseek 如何合成下界合金装备？
#gemini 凋零骷髅在哪里生成？
#chatgpt 介绍一下 Minecraft 1.20 的新内容
#grok 帮我找一个远古城市
#claude 建造一个简易红石农场
```

### 私聊
使用 `/msg` 或 `/tell` 悄悄与机器人对话：
```
/msg Bot名称 #deepseek 末影龙怎么召唤？
```
机器人会以私聊方式回复（命令执行除外）。

### 帮助命令
发送 `#bot help` 获取功能说明，机器人会以私聊形式回复详细帮助。

### 机器人管理员命令（仅 `BOT_ADMIN` 可用）
- `#ban <玩家名>`：禁止该玩家使用任何 AI 功能。
- `#unban <玩家名>`：解除封禁。
- `#banlist`：查看当前被封禁的玩家列表。

### CDK 兑换系统（仅 `ADMIN_NAME` 可用）
- `#addCDK <命令模板>`：生成一个 CDK 码。模板中用 `{}` 代表兑换者名字，多条命令用 `&` 连接。  
  示例：`#addCDK /give {} diamond 10 & /msg {} 恭喜获得钻石！`  
  生成一个 6 位 CDK 码，玩家使用后可获得钻石并收到私聊消息。
- `#useCDK <CDK码>`：所有玩家可用，兑换后执行关联命令（命令中的 `{}` 会被替换为玩家名）。

### 游戏内管理员特殊行为（`ADMIN_NAME`）
当发送者为管理员时，AI 必须返回严格 JSON 格式，例如：
```json
{
  "commands": ["/give alice diamond_sword", "/time set day"],
  "chat": "已为你执行命令！"
}
```
- `commands` 数组中的命令会被机器人**公开执行**（每条间隔 600ms）。
- `chat` 字段会以**原发送方式**（公开或私聊）分段发送。
- 若 AI 返回非 JSON 文本，则按普通聊天处理（仅当包含以 `/` 开头的行时尝试回退执行）。

## 💬 QQ 互通部署教程

### 1. 安装 NapCat
NapCat 是一个基于 QQ 协议的高性能机器人框架，具体安装过程在此不赘述，请参见官方文档


### 2. 配置 NapCat HTTP 服务
在 NapCat WebUI 中：
- 进入 **网络配置**
- 创建HTTP服务器，设置端口（例如 `3000`），**不设置访问令牌**，创建好后，将地址填入NAPCAT_API
- 再创建一个 **HTTP 客户端**，配置：
  - 上报地址：.env里BRIDGE_URL填的啥就填啥
  - 消息格式：`Array`
- 保存配置

### 3. 修改项目 `.env` 文件
添加或修改以下变量：
```ini
# NapCat 配置
NAPCAT_API=http://127.0.0.1:3000   # 与 NapCat HTTP 服务端口一致
QQ_GROUP_ID=1091606325            # 你的 QQ 群号
BOT_QQ=1563715115                 # 机器人 QQ 号

# 桥接服务配置
BRIDGE_URL=http://127.0.0.1:82/api/mc-message
BRIDGE_PORT=82
```

**不要改后面的/api/mc-message！！！！！！**

### 4. 启动所有服务
执行 `python main.py`，启动器会自动启动 bot、Web 和桥接服务。  
确认桥接服务日志显示 `[Bridge] QQ-Minecraft 桥接服务运行在 http://0.0.0.0:82`。

### 5. 测试互通
- 在 QQ 群发送一条纯文本消息，游戏内应显示 `[QQ] 昵称: 消息`。
- 在游戏内发送一条普通聊天（不含 `#` 前缀），QQ 群应显示 `[Minecraft] 玩家名: 消息`。
- 私聊、AI 指令、帮助命令不会被转发。

### 注意事项
- NapCat 的 HTTP API 端口不能与 Web 管理端口（6099）冲突。
- 如果 NapCat 和桥接服务不在同一台服务器，需要将 `127.0.0.1` 替换为实际 IP，并确保防火墙放行对应端口。
- 如果 NapCat 启用了访问令牌，请在桥接服务代码中添加 `NAPCAT_ACCESS_TOKEN` 环境变量支持（参考 `qq-bridge.js` 注释）。

## 📊 Token 统计

程序退出时会打印累计 Token 使用量和各模型调用次数，例如：
```
========== Token 使用统计 ==========
Deepseek 调用次数: 12
Gemini 调用次数: 5
GPT 调用次数: 8
Grok 调用次数: 3
Claude 调用次数: 2
累计 token (五者合计): 28500
=====================================
```

## 🔧 故障排除

- **连接超时/ECONNRESET**  
  网络不稳定或服务器问题，自动重连会处理。可检查服务器地址和端口是否正确，以及防火墙/安全组是否放行。

- **模型调用返回错误**  
  通常为服务端临时故障或 API 密钥无效，可稍后重试或检查密钥。请确保使用正确的端点（特别是中转服务）。

- **私聊不回复**  
  确认服务器支持私聊（多数服务器默认开启），且机器人用户名正确。

- **防刷屏仍被踢**  
  尝试增大 `CHAT_DELAY_MS` 的值（如改为 1500），或检查服务器反刷屏插件的具体规则。

- **Web 界面无法访问**  
  检查服务器防火墙是否开放了 `WEB_PORT` 端口，以及是否在云控制台安全组中放行。确保 `web.js` 已成功启动（控制台应有日志输出）。

- **QQ 互通无消息**  
  - 确认 NapCat 已正确配置 HTTP 上报地址且端口未冲突。
  - 检查桥接服务日志是否有 `[Bridge] 收到 webhook 请求` 输出。
  - 确认 `.env` 中的 `QQ_GROUP_ID` 和 `BOT_QQ` 正确。
  - 手动测试 NapCat API：`curl -X POST http://127.0.0.1:3000/send_group_msg -d '{"group_id":群号,"message":"test"}'`，若返回 404 需调整 `NAPCAT_API` 路径。

## 🔧 特殊说明
- **Gemini** 当前使用的是 OpenAI 协议，后续可能会改回原生协议。
- **.env.example 是示例配置文件**，请复制并重命名为 `.env`，然后填写你的配置。

![](https://picui.ogmua.cn/s1/2026/02/26/699fb1657ad25.webp)

欢迎提交 Issue 或 Pull Request 改进本项目！