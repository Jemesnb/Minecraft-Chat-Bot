# Minecraft Chat Bot

一个功能强大的 Minecraft 聊天机器人，支持多款 AI 模型（Deepseek、Gemini、ChatGPT、Grok、Claude），具备自动重连、私聊回复、防刷屏分段发送、管理员命令执行、Token 统计等特性。通过 Python 启动器一键运行，无需手动安装 Node 依赖。

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
  当发送者为管理员时，强制要求 AI 返回 JSON 格式的命令数组，机器人自动解析并执行（命令公开执行，聊天部分保持原回复方式）。

- **Token 使用统计**  
  每次调用记录 token 消耗和调用次数，退出时打印汇总统计。

- **初始化动作**  
  可设置机器人登录后立即执行的聊天内容（例如 `/login password`）。

## 📦 安装

### 环境要求
- Python 3.6 或更高版本
- Node.js (v14 或更高，附带 npm)

### 安装依赖
无需手动操作，Python 启动器会在首次运行时自动执行 `npm install`（有可能会失效）。

## ⚙️ 配置

所有配置均通过环境变量进行。建议创建 `.env` 文件放在项目根目录，启动器会自动加载。

### 基础 Minecraft 配置
| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `MC_HOST` | 服务器地址 | `localhost` |
| `MC_PORT` | 服务器端口 | `25565` |
| `MC_USERNAME` | 机器人用户名 | `DeepBot` |
| `MC_PASSWORD` | 密码（在线模式需要） | 无 |
| `MC_ONLINE` | 是否正版验证 | `false` |
| `MC_INITIAL_ACTION` | 登录后立即执行的聊天内容 | 空 |
| `MC_ADMIN` | 管理员游戏名（可执行命令） | `` |

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

### 防刷屏配置
| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `CHAT_DELAY_MS` | 行间发送延迟（毫秒） | `600` |


## 🚀 运行

### 使用 Python 启动器（推荐）
在项目根目录执行：
```bash
python main.py
```
启动器会自动：
- 检查 Node.js 环境
- 加载 `.env` 文件中的环境变量
- 启动 `bot.js`

### 停止
按 `Ctrl+C` 即可终止机器人，启动器会正确处理退出并打印 Token 统计。

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
发送 `#bot help` 获取功能说明：
```
=========功能=========
#模型名+空格+你要对AI说的话
目前有以下模型名：deepseek、gemini、chatgpt、grok、claude
例如：#deepseek 末影人为什么怕水？
冷知识：/msg和tell命令也能触发AI，用法和直接打出来一样哦
```

### 管理员特殊行为
当发送者为管理员（`ADMIN_NAME`）时，AI 必须返回严格 JSON 格式，例如：
```json
{
  "commands": ["/give alice diamond_sword", "/time set day"],
  "chat": "已为你执行命令！"
}
```
- `commands` 数组中的命令会被机器人**公开执行**（每条间隔 600ms）
- `chat` 字段会以**原发送方式**（公开或私聊）分段发送
- 若 AI 返回非 JSON 文本，则按普通聊天处理（仅当包含以 `/` 开头的行时尝试回退执行）

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
  网络不稳定或服务器问题，自动重连会处理。

- **模型调用返回错误**  
  通常为服务端临时故障或 API 密钥无效，可稍后重试或检查密钥。请确保使用正确的端点（特别是中转服务）。

- **私聊不回复**  
  确认服务器支持私聊（多数服务器默认开启），且机器人用户名正确。

- **防刷屏仍被踢**  
  尝试增大 `CHAT_DELAY_MS` 的值（如改为 1500），或检查服务器反刷屏插件的具体规则。

## 🔧 特殊说明
- **gemini**
  使用的是openai协议，后面会用回gemini协议

![这是一张图片](https://picui.ogmua.cn/s1/2026/02/26/699fb1657ad25.webp)

欢迎提交 Issue 或 Pull Request 改进本项目！# Minecraft Chat Bot
