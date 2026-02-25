const mineflayer = require('mineflayer')
const fetch = require('node-fetch')
const fs = require('fs')
const path = require('path')

// ==================== 日志初始化 ====================
const LOG_DIR = path.join(__dirname, 'logs')
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true })
}

// 获取当前日期作为日志文件名 (YYYY-MM-DD)
const dateStr = new Date().toISOString().slice(0, 10)
const logFile = path.join(LOG_DIR, `${dateStr}.log`)

// 保存原始控制台方法
const originalLog = console.log
const originalError = console.error
const originalWarn = console.warn

// 辅助函数：写入日志文件（同步追加）
function writeToLog(level, args) {
  const timestamp = new Date().toISOString()
  const message = `[${timestamp}] [${level}] ${Array.from(args).map(arg => 
    typeof arg === 'string' ? arg : JSON.stringify(arg)
  ).join(' ')}\n`
  
  fs.appendFileSync(logFile, message, { encoding: 'utf8' })
}

// 重写 console.log
console.log = function(...args) {
  originalLog.apply(console, args)
  writeToLog('INFO', args)
}

// 重写 console.error
console.error = function(...args) {
  originalError.apply(console, args)
  writeToLog('ERROR', args)
}

// 重写 console.warn
console.warn = function(...args) {
  originalWarn.apply(console, args)
  writeToLog('WARN', args)
}

// ==================== 全局配置与环境变量 ====================
const host = process.env.MC_HOST || 'localhost'
const port = parseInt(process.env.MC_PORT || '25565', 10)
const username = process.env.MC_USERNAME || 'DeepBot'
const password = process.env.MC_PASSWORD || undefined
const onlineMode = (process.env.MC_ONLINE || 'false').toLowerCase() === 'true'
const INITIAL_ACTION = process.env.MC_INITIAL_ACTION || ''

// 游戏内管理员名称（可执行游戏命令）
const ADMIN_NAME = (typeof process.env.ADMIN_NAME !== 'undefined') ? process.env.ADMIN_NAME : 'dengjiewei'

// 机器人管理员名称（可执行封禁命令），默认为空表示无机器人管理员
const BOT_ADMIN = process.env.BOT_ADMIN || ''

// -------------------- Deepseek 配置（默认官方）--------------------
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || ''
const DEEPSEEK_ENDPOINT = process.env.DEEPSEEK_ENDPOINT || 'https://api.deepseek.com'
const DEEPSEEK_PATH = process.env.DEEPSEEK_PATH || '/v1/chat/completions'
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-reasoner'
const DEEPSEEK_PREFIX = process.env.DEEPSEEK_PREFIX || '#deepseek '

// -------------------- Gemini 配置（默认 OpenAI 兼容中转）--------------------
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const GEMINI_ENDPOINT = process.env.GEMINI_ENDPOINT || 'https://generativelanguage.googleapis.com'
const GEMINI_PATH = process.env.GEMINI_PATH || '/v1/chat/completions'
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-pro'
const GEMINI_PREFIX = process.env.GEMINI_PREFIX || '#gemini '

// -------------------- GPT (OpenAI) 配置 --------------------
const GPT_API_KEY = process.env.CHATGPT_API_KEY || ''
const GPT_ENDPOINT = process.env.CHATGPT_ENDPOINT || 'https://api.openai.com'
const GPT_PATH = process.env.CHATGPT_PATH || '/v1/chat/completions'
const GPT_MODEL = process.env.CHATGPT_MODEL || 'gpt-3.5-turbo'
const GPT_PREFIX = process.env.CHATGPT_PREFIX || '#chatgpt '

// -------------------- Grok 配置（OpenAI 协议）--------------------
const GROK_API_KEY = process.env.GROK_API_KEY || ''
const GROK_ENDPOINT = process.env.GROK_ENDPOINT || 'https://api.x.ai'        // 默认端点，可自定义
const GROK_PATH = process.env.GROK_PATH || '/v1/chat/completions'
const GROK_MODEL = process.env.GROK_MODEL || 'grok-1'                         // 默认模型名
const GROK_PREFIX = process.env.GROK_PREFIX || '#grok '

// -------------------- Claude 配置（OpenAI 协议）--------------------
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || ''
const CLAUDE_ENDPOINT = process.env.CLAUDE_ENDPOINT || 'https://api.anthropic.com'   // 默认端点
const CLAUDE_PATH = process.env.CLAUDE_PATH || '/v1/chat/completions'                 // OpenAI 兼容路径
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-3-opus-latest'               // 默认模型
const CLAUDE_PREFIX = process.env.CLAUDE_PREFIX || '#claude '

// -------------------- 防刷屏分段配置 --------------------
let CHAT_CHUNK_SIZE = parseInt(process.env.CHAT_CHUNK_SIZE || '150', 10)  // 仅用于兼容旧变量名，实际未使用
if (isNaN(CHAT_CHUNK_SIZE) || CHAT_CHUNK_SIZE < 1) CHAT_CHUNK_SIZE = 150

let CHAT_DELAY_MS = parseInt(process.env.CHAT_DELAY_MS || '600', 10)      // 段间延迟（毫秒）
if (isNaN(CHAT_DELAY_MS) || CHAT_DELAY_MS < 0) CHAT_DELAY_MS = 600

// ==================== 全局统计变量 ====================
let TOTAL_TOKENS_USED = 0
let DEEPSEEK_CALLS = 0
let GEMINI_CALLS = 0
let GPT_CALLS = 0
let GROK_CALLS = 0
let CLAUDE_CALLS = 0

// ==================== 黑名单持久化 ====================
const BANLIST_FILE = path.join(__dirname, 'banned.json')
let bannedPlayers = new Set()  // 存储小写玩家名

// 加载黑名单
function loadBanList() {
  try {
    if (fs.existsSync(BANLIST_FILE)) {
      const data = fs.readFileSync(BANLIST_FILE, 'utf8')
      const arr = JSON.parse(data)
      bannedPlayers = new Set(arr.map(name => name.toLowerCase()))
      console.log(`已加载黑名单，共 ${bannedPlayers.size} 个玩家`)
    } else {
      console.log('黑名单文件不存在，将创建新文件')
    }
  } catch (err) {
    console.error('加载黑名单失败:', err)
  }
}

// 保存黑名单
function saveBanList() {
  try {
    const arr = Array.from(bannedPlayers)
    fs.writeFileSync(BANLIST_FILE, JSON.stringify(arr, null, 2), 'utf8')
    console.log('黑名单已保存')
  } catch (err) {
    console.error('保存黑名单失败:', err)
  }
}

// ==================== 自动重连相关 ====================
let bot = null
let reconnectAttempts = 0
const MAX_RECONNECT_ATTEMPTS = Infinity
const RECONNECT_DELAY = 5000

// 消息缓存：每条消息包含用户名、内容、是否为私聊
let chatBuffer = []

// ==================== 创建机器人实例 ====================
function createBotInstance() {
  if (bot) {
    bot.removeAllListeners()
    bot.end()
    bot = null
  }

  bot = mineflayer.createBot({
    host, port, username, password,
    auth: onlineMode ? 'mojang' : 'offline'
  })

  bot.on('login', () => {
    console.log('Logged in as', bot.username)
    if (INITIAL_ACTION) {
      try { bot.chat(INITIAL_ACTION) } catch (e) { console.warn('INITIAL_ACTION failed:', e) }
    }
    reconnectAttempts = 0
  })

  // 公共聊天事件
  bot.on('chat', (username_, message) => {
    chatBuffer.push({ username: username_, message, time: Date.now(), whisper: false })
  })

  // 私聊事件 (whisper)
  bot.on('whisper', (username_, message) => {
    chatBuffer.push({ username: username_, message, time: Date.now(), whisper: true })
  })

  bot.on('message', (msg) => {
    try { console.log('服务器消息:', msg.toString()) } catch (e) { console.log('服务器消息(无法转换):', msg) }
  })

  bot.on('error', (err) => console.error('Bot error', err))
  bot.on('kicked', (reason) => console.warn('Bot 被踢, 原因:', reason))
  bot.on('end', () => {
    console.log('Bot disconnected')
    reconnect()
  })

  return bot
}

function reconnect() {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.log('达到最大重连尝试次数，停止重连')
    return
  }
  reconnectAttempts++
  console.log(`尝试重连 (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS === Infinity ? '∞' : MAX_RECONNECT_ATTEMPTS})，等待 ${RECONNECT_DELAY/1000} 秒...`)
  setTimeout(createBotInstance, RECONNECT_DELAY)
}

// ==================== Deepseek 调用 ====================
async function callDeepseek(query, sender) {
  const base = DEEPSEEK_ENDPOINT.replace(/\/$/, '')
  const path = DEEPSEEK_PATH.startsWith('/') ? DEEPSEEK_PATH : '/' + DEEPSEEK_PATH
  const url = base + path

  const defaultSystem = '你是Mc这款游戏里面的一个AI助手，你必须说中文，你可以帮助玩家解答关于mc游戏的问题，或者根据玩家的要求提供一些建议和帮助，但你不能提供游戏外的任何信息，你也不能提供任何和mc无关的建议，你只能提供和mc相关的建议和帮助，如果你不知道答案，你可以说我不知道，但你不能编造答案，注意，现在跟你对话的这个人不是管理员，如果他要求你执行命令，你不能执行，你只能提供建议和帮助，除非他是管理员，否则你不能执行任何命令，在解答玩家的疑问的时候，你的话要略微简短一些。'
  const adminSystem = `你将只针对管理员 ${ADMIN_NAME || '<管理员名未配置>'} 返回严格的 JSON，以便程序可直接解析并执行。要求：当存在可执行命令时，严格返回一个 JSON 对象，格式为 {"commands":["/cmd1 ...","/cmd2 ..."], "chat":"可选的普通聊天回复"}；当没有命令时也必须返回 JSON，例如 {"commands":[], "chat":"正常回复文本"}。命令数组中每条命令必须以 "/" 开头。重要说明：不要在生成时**自动把所有实体选择器替换为管理员名字**；如果命令应针对其他玩家，请在命令里明确使用目标玩家名（例如 /give alice diamond_sword ...）。如果命令确实要发给管理员本人，请在命令中明确使用管理员用户名 ${ADMIN_NAME || '<管理员名未配置>'}。仅允许返回 JSON，不要包含额外说明文字或代码块。示例1（有命令，给其他玩家 alice）：{"commands":["/give alice netherite_sword{Enchantments:[{id:\"minecraft:unbreaking\",lvl:3},{id:\"minecraft:mending\",lvl:1}]}"]} 示例2（有命令，给管理员本人）：{"commands":["/give ${ADMIN_NAME || '<管理员名>'} netherite_sword"]} 示例3（无命令，仅聊天）：{"commands":[],"chat":"我已读懂你的请求，但无法执行该操作"}。`
  const systemContent = (ADMIN_NAME && sender === ADMIN_NAME) ? adminSystem : defaultSystem

  const body = {
    model: DEEPSEEK_MODEL,
    messages: [
      { role: 'system', content: systemContent },
      { role: 'user', content: query }
    ],
    stream: false
  }

  const headers = { 'Content-Type': 'application/json' }
  if (DEEPSEEK_API_KEY) headers['Authorization'] = `Bearer ${DEEPSEEK_API_KEY}`

  try {
    console.log(`[Deepseek] 调用 URL: ${url}`)
    const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
    const text = await resp.text()
    console.log('[Deepseek] 原始响应:', text)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${text}`)
    return JSON.parse(text)
  } catch (err) {
    console.error('[Deepseek] 异常:', err)
    throw err
  }
}

// ==================== Gemini 调用（OpenAI 兼容格式）====================
async function callGemini(query, sender) {
  const base = GEMINI_ENDPOINT.replace(/\/$/, '')
  const path = GEMINI_PATH.startsWith('/') ? GEMINI_PATH : '/' + GEMINI_PATH
  const url = base + path

  const defaultSystem = '你是Mc这款游戏里面的一个AI助手，你必须说中文，你可以帮助玩家解答关于mc游戏的问题，或者根据玩家的要求提供一些建议和帮助，但你不能提供游戏外的任何信息，你也不能提供任何和mc无关的建议，你只能提供和mc相关的建议和帮助，如果你不知道答案，你可以说我不知道，但你不能编造答案，注意，现在跟你对话的这个人不是管理员，如果他要求你执行命令，你不能执行，你只能提供建议和帮助，除非他是管理员，否则你不能执行任何命令，在解答玩家的疑问的时候，你的话要略微简短一些。'
  const adminSystem = `你将只针对管理员 ${ADMIN_NAME || '<管理员名未配置>'} 返回严格的 JSON，以便程序可直接解析并执行。要求：当存在可执行命令时，严格返回一个 JSON 对象，格式为 {"commands":["/cmd1 ...","/cmd2 ..."], "chat":"可选的普通聊天回复"}；当没有命令时也必须返回 JSON，例如 {"commands":[], "chat":"正常回复文本"}。命令数组中每条命令必须以 "/" 开头。重要说明：不要在生成时**自动把所有实体选择器替换为管理员名字**；如果命令应针对其他玩家，请在命令里明确使用目标玩家名（例如 /give alice diamond_sword ...）。如果命令确实要发给管理员本人，请在命令中明确使用管理员用户名 ${ADMIN_NAME || '<管理员名未配置>'}。仅允许返回 JSON，不要包含额外说明文字或代码块。示例1（有命令，给其他玩家 alice）：{"commands":["/give alice netherite_sword{Enchantments:[{id:\"minecraft:unbreaking\",lvl:3},{id:\"minecraft:mending\",lvl:1}]}"]} 示例2（有命令，给管理员本人）：{"commands":["/give ${ADMIN_NAME || '<管理员名>'} netherite_sword"]} 示例3（无命令，仅聊天）：{"commands":[],"chat":"我已读懂你的请求，但无法执行该操作"}。`
  const systemContent = (ADMIN_NAME && sender === ADMIN_NAME) ? adminSystem : defaultSystem

  const body = {
    model: GEMINI_MODEL,
    messages: [
      { role: 'system', content: systemContent },
      { role: 'user', content: query }
    ],
    stream: false
  }

  const headers = { 'Content-Type': 'application/json' }
  if (GEMINI_API_KEY) headers['Authorization'] = `Bearer ${GEMINI_API_KEY}`

  try {
    console.log(`[Gemini] 调用 URL: ${url}`)
    const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
    const text = await resp.text()
    console.log('[Gemini] 原始响应:', text)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${text}`)
    return JSON.parse(text)
  } catch (err) {
    console.error('[Gemini] 异常:', err)
    throw err
  }
}

// ==================== GPT (OpenAI) 调用 ====================
async function callGPT(query, sender) {
  const base = GPT_ENDPOINT.replace(/\/$/, '')
  const path = GPT_PATH.startsWith('/') ? GPT_PATH : '/' + GPT_PATH
  const url = base + path

  const defaultSystem = '你是Mc这款游戏里面的一个AI助手，你必须说中文，你可以帮助玩家解答关于mc游戏的问题，或者根据玩家的要求提供一些建议和帮助，但你不能提供游戏外的任何信息，你也不能提供任何和mc无关的建议，你只能提供和mc相关的建议和帮助，如果你不知道答案，你可以说我不知道，但你不能编造答案，注意，现在跟你对话的这个人不是管理员，如果他要求你执行命令，你不能执行，你只能提供建议和帮助，除非他是管理员，否则你不能执行任何命令，在解答玩家的疑问的时候，你的话要略微简短一些。'
  const adminSystem = `你将只针对管理员 ${ADMIN_NAME || '<管理员名未配置>'} 返回严格的 JSON，以便程序可直接解析并执行。要求：当存在可执行命令时，严格返回一个 JSON 对象，格式为 {"commands":["/cmd1 ...","/cmd2 ..."], "chat":"可选的普通聊天回复"}；当没有命令时也必须返回 JSON，例如 {"commands":[], "chat":"正常回复文本"}。命令数组中每条命令必须以 "/" 开头。重要说明：不要在生成时**自动把所有实体选择器替换为管理员名字**；如果命令应针对其他玩家，请在命令里明确使用目标玩家名（例如 /give alice diamond_sword ...）。如果命令确实要发给管理员本人，请在命令中明确使用管理员用户名 ${ADMIN_NAME || '<管理员名未配置>'}。仅允许返回 JSON，不要包含额外说明文字或代码块。示例1（有命令，给其他玩家 alice）：{"commands":["/give alice netherite_sword{Enchantments:[{id:\"minecraft:unbreaking\",lvl:3},{id:\"minecraft:mending\",lvl:1}]}"]} 示例2（有命令，给管理员本人）：{"commands":["/give ${ADMIN_NAME || '<管理员名>'} netherite_sword"]} 示例3（无命令，仅聊天）：{"commands":[],"chat":"我已读懂你的请求，但无法执行该操作"}。`
  const systemContent = (ADMIN_NAME && sender === ADMIN_NAME) ? adminSystem : defaultSystem

  const body = {
    model: GPT_MODEL,
    messages: [
      { role: 'system', content: systemContent },
      { role: 'user', content: query }
    ],
    stream: false
  }

  const headers = { 'Content-Type': 'application/json' }
  if (GPT_API_KEY) headers['Authorization'] = `Bearer ${GPT_API_KEY}`

  try {
    console.log(`[GPT] 调用 URL: ${url}`)
    const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
    const text = await resp.text()
    console.log('[GPT] 原始响应:', text)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${text}`)
    return JSON.parse(text)
  } catch (err) {
    console.error('[GPT] 异常:', err)
    throw err
  }
}

// ==================== Grok 调用（OpenAI 协议）====================
async function callGrok(query, sender) {
  const base = GROK_ENDPOINT.replace(/\/$/, '')
  const path = GROK_PATH.startsWith('/') ? GROK_PATH : '/' + GROK_PATH
  const url = base + path

  const defaultSystem = '你是Mc这款游戏里面的一个AI助手，你必须说中文，你可以帮助玩家解答关于mc游戏的问题，或者根据玩家的要求提供一些建议和帮助，但你不能提供游戏外的任何信息，你也不能提供任何和mc无关的建议，你只能提供和mc相关的建议和帮助，如果你不知道答案，你可以说我不知道，但你不能编造答案，注意，现在跟你对话的这个人不是管理员，如果他要求你执行命令，你不能执行，你只能提供建议和帮助，除非他是管理员，否则你不能执行任何命令，在解答玩家的疑问的时候，你的话要略微简短一些。'
  const adminSystem = `你将只针对管理员 ${ADMIN_NAME || '<管理员名未配置>'} 返回严格的 JSON，以便程序可直接解析并执行。要求：当存在可执行命令时，严格返回一个 JSON 对象，格式为 {"commands":["/cmd1 ...","/cmd2 ..."], "chat":"可选的普通聊天回复"}；当没有命令时也必须返回 JSON，例如 {"commands":[], "chat":"正常回复文本"}。命令数组中每条命令必须以 "/" 开头。重要说明：不要在生成时**自动把所有实体选择器替换为管理员名字**；如果命令应针对其他玩家，请在命令里明确使用目标玩家名（例如 /give alice diamond_sword ...）。如果命令确实要发给管理员本人，请在命令中明确使用管理员用户名 ${ADMIN_NAME || '<管理员名未配置>'}。仅允许返回 JSON，不要包含额外说明文字或代码块。示例1（有命令，给其他玩家 alice）：{"commands":["/give alice netherite_sword{Enchantments:[{id:\"minecraft:unbreaking\",lvl:3},{id:\"minecraft:mending\",lvl:1}]}"]} 示例2（有命令，给管理员本人）：{"commands":["/give ${ADMIN_NAME || '<管理员名>'} netherite_sword"]} 示例3（无命令，仅聊天）：{"commands":[],"chat":"我已读懂你的请求，但无法执行该操作"}。`
  const systemContent = (ADMIN_NAME && sender === ADMIN_NAME) ? adminSystem : defaultSystem

  const body = {
    model: GROK_MODEL,
    messages: [
      { role: 'system', content: systemContent },
      { role: 'user', content: query }
    ],
    stream: false
  }

  const headers = { 'Content-Type': 'application/json' }
  if (GROK_API_KEY) headers['Authorization'] = `Bearer ${GROK_API_KEY}`

  try {
    console.log(`[Grok] 调用 URL: ${url}`)
    const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
    const text = await resp.text()
    console.log('[Grok] 原始响应:', text)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${text}`)
    return JSON.parse(text)
  } catch (err) {
    console.error('[Grok] 异常:', err)
    throw err
  }
}

// ==================== Claude 调用（OpenAI 协议）====================
async function callClaude(query, sender) {
  const base = CLAUDE_ENDPOINT.replace(/\/$/, '')
  const path = CLAUDE_PATH.startsWith('/') ? CLAUDE_PATH : '/' + CLAUDE_PATH
  const url = base + path

  const defaultSystem = '你是Mc这款游戏里面的一个AI助手，你必须说中文，你可以帮助玩家解答关于mc游戏的问题，或者根据玩家的要求提供一些建议和帮助，但你不能提供游戏外的任何信息，你也不能提供任何和mc无关的建议，你只能提供和mc相关的建议和帮助，如果你不知道答案，你可以说我不知道，但你不能编造答案，注意，现在跟你对话的这个人不是管理员，如果他要求你执行命令，你不能执行，你只能提供建议和帮助，除非他是管理员，否则你不能执行任何命令，在解答玩家的疑问的时候，你的话要略微简短一些。'
  const adminSystem = `你将只针对管理员 ${ADMIN_NAME || '<管理员名未配置>'} 返回严格的 JSON，以便程序可直接解析并执行。要求：当存在可执行命令时，严格返回一个 JSON 对象，格式为 {"commands":["/cmd1 ...","/cmd2 ..."], "chat":"可选的普通聊天回复"}；当没有命令时也必须返回 JSON，例如 {"commands":[], "chat":"正常回复文本"}。命令数组中每条命令必须以 "/" 开头。重要说明：不要在生成时**自动把所有实体选择器替换为管理员名字**；如果命令应针对其他玩家，请在命令里明确使用目标玩家名（例如 /give alice diamond_sword ...）。如果命令确实要发给管理员本人，请在命令中明确使用管理员用户名 ${ADMIN_NAME || '<管理员名未配置>'}。仅允许返回 JSON，不要包含额外说明文字或代码块。示例1（有命令，给其他玩家 alice）：{"commands":["/give alice netherite_sword{Enchantments:[{id:\"minecraft:unbreaking\",lvl:3},{id:\"minecraft:mending\",lvl:1}]}"]} 示例2（有命令，给管理员本人）：{"commands":["/give ${ADMIN_NAME || '<管理员名>'} netherite_sword"]} 示例3（无命令，仅聊天）：{"commands":[],"chat":"我已读懂你的请求，但无法执行该操作"}。`
  const systemContent = (ADMIN_NAME && sender === ADMIN_NAME) ? adminSystem : defaultSystem

  const body = {
    model: CLAUDE_MODEL,
    messages: [
      { role: 'system', content: systemContent },
      { role: 'user', content: query }
    ],
    stream: false
  }

  const headers = { 'Content-Type': 'application/json' }
  if (CLAUDE_API_KEY) headers['Authorization'] = `Bearer ${CLAUDE_API_KEY}`

  try {
    console.log(`[Claude] 调用 URL: ${url}`)
    const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
    const text = await resp.text()
    console.log('[Claude] 原始响应:', text)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${text}`)
    return JSON.parse(text)
  } catch (err) {
    console.error('[Claude] 异常:', err)
    throw err
  }
}

// ==================== 分段发送消息（支持私聊或公开）====================
async function sendChunks(text, target, isWhisper = false, delay = CHAT_DELAY_MS) {
  if (!text) return

  // 确保 delay 有效
  let waitTime = typeof delay === 'number' && delay > 0 ? delay : CHAT_DELAY_MS
  if (isNaN(waitTime) || waitTime < 0) waitTime = 600

  // 按换行符分割文本，保留原始行（不 trim，但判断空行时使用 trim 后的长度）
  const lines = text.split('\n')
  console.log(`[${new Date().toISOString()}] 开始按行发送，共 ${lines.length} 行，行间延迟 ${waitTime}ms`)

  let sentCount = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // 判断是否为空行（去除首尾空格后长度为0）
    if (line.trim().length === 0) {
      console.log(`[${new Date().toISOString()}] 跳过空行 #${i+1}`)
      continue
    }

    sentCount++
    console.log(`[${new Date().toISOString()}] 发送行 #${i+1}，长度 ${line.length}，内容预览: ${line.substring(0, 50)}${line.length > 50 ? '...' : ''}`)

    try {
      if (isWhisper) {
        bot.whisper(target, line)   // 私聊回复
      } else {
        bot.chat(line)              // 公开聊天
      }
    } catch (e) {
      console.warn('发送消息失败', e)
    }

    // 查找下一个非空行的索引
    let nextNonEmpty = i + 1
    while (nextNonEmpty < lines.length && lines[nextNonEmpty].trim().length === 0) {
      nextNonEmpty++
    }
    if (nextNonEmpty < lines.length) {
      console.log(`[${new Date().toISOString()}] 等待 ${waitTime}ms 后发送下一行`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
  }
}

// ==================== 统一回复处理（管理员命令解析 + 分段发送）====================
async function handleReply(replyText, sender, isWhisper = false) {
  if (ADMIN_NAME && sender === ADMIN_NAME) {
    let parsed = null
    try {
      parsed = JSON.parse(replyText)
    } catch (e) {
      parsed = null
    }

    if (parsed && Array.isArray(parsed.commands)) {
      // 有效 JSON 格式
      if (parsed.commands.length === 0) {
        if (parsed.chat) {
          await sendChunks(parsed.chat, sender, isWhisper)   // 分段发送普通聊天（保持私聊/公开一致）
        }
      } else {
        for (const cmd of parsed.commands) {
          if (!cmd || typeof cmd !== 'string') continue
          let cmdText = cmd.trim()
          if (!cmdText.startsWith('/')) cmdText = '/' + cmdText
          try {
            console.log('执行命令:', cmdText)
            // 命令始终公开执行（即使是通过私聊触发的）
            bot.chat(cmdText)
          } catch (e) {
            console.warn('执行命令失败', cmdText, e)
          }
          await new Promise(r => setTimeout(r, 600)) // 命令间隔
        }
        // 如果有 chat 字段，也发送聊天（保持私聊/公开一致）
        if (parsed.chat) {
          await sendChunks(parsed.chat, sender, isWhisper)
        }
      }
    } else {
      // 回退：按 & 分割，只执行以 / 开头的部分
      const parts = replyText.split('&').map(s => s.trim()).filter(Boolean)
      const containsCommand = parts.some(part => part.startsWith('/'))
      if (!containsCommand) {
        await sendChunks(replyText, sender, isWhisper)   // 无命令，分段发送聊天（保持私聊/公开一致）
      } else {
        for (const part of parts) {
          if (!part.startsWith('/')) continue
          try {
            console.log('执行命令(fallback):', part)
            bot.chat(part)  // 命令公开执行
          } catch (e) { console.warn('执行命令失败', part, e) }
          await new Promise(r => setTimeout(r, 600))
        }
        // 如果有非命令部分，也发送聊天（这里简单将整个回复作为聊天，但命令已提取，剩余部分已丢弃）
        // 为了简化，如果存在命令且还有非命令部分，我们丢弃非命令部分（与原逻辑一致）
      }
    }
  } else {
    // 非管理员，直接分段发送聊天（保持私聊/公开一致）
    await sendChunks(replyText, sender, isWhisper)
  }
}

// ==================== 处理单条消息的异步函数 ====================
async function processMessage(m) {
  if (!m.message || m.username === bot.username) return

  const trimmed = m.message.trim()
  const lowerSender = m.username.toLowerCase()

  // ========== 机器人管理员封禁命令 ==========
  if (BOT_ADMIN && m.username === BOT_ADMIN) {
    // 处理 #ban <玩家名>
    if (trimmed.startsWith('#ban ')) {
      const target = trimmed.slice(5).trim()
      if (target) {
        bannedPlayers.add(target.toLowerCase())
        saveBanList()   // 立即保存黑名单
        const reply = `玩家 ${target} 已被禁止使用 AI。`
        if (m.whisper) {
          bot.whisper(m.username, reply)
        } else {
          bot.chat(reply)
        }
      }
      return
    }
    // 处理 #unban <玩家名>
    if (trimmed.startsWith('#unban ')) {
      const target = trimmed.slice(7).trim()
      if (target) {
        bannedPlayers.delete(target.toLowerCase())
        saveBanList()   // 立即保存黑名单
        const reply = `玩家 ${target} 已解除封禁。`
        if (m.whisper) {
          bot.whisper(m.username, reply)
        } else {
          bot.chat(reply)
        }
      }
      return
    }
    // 处理 #banlist
    if (trimmed === '#banlist') {
      const list = Array.from(bannedPlayers)
      let reply = list.length === 0 ? '暂无被封禁的玩家。' : '被封禁玩家：' + list.join(', ')
      if (m.whisper) {
        bot.whisper(m.username, reply)
      } else {
        bot.chat(reply)
      }
      return
    }
  }

  // ========== 黑名单检查 ==========
  if (bannedPlayers.has(lowerSender)) {
    // 被封禁的玩家不触发任何 AI 功能（可改为回复提示，此处选择静默忽略）
    return
  }

  // 帮助命令（支持公开和私聊）
  if (trimmed === '#bot help') {
    const helpText = '=========功能=========\n#模型名+空格+你要对AI说的话\n目前有以下模型名：deepseek、gemini、chatgpt、grok、claude\n例如：#deepseek 末影人为什么怕水？\n冷知识：/msg和tell命令也能触发AI，用法和直接打出来一样哦';
    await sendChunks(helpText, m.username, m.whisper);
    return;
  }

  const isDeepseek = m.message.startsWith(DEEPSEEK_PREFIX)
  const isGemini = GEMINI_API_KEY && m.message.startsWith(GEMINI_PREFIX)
  const isGPT = GPT_API_KEY && m.message.startsWith(GPT_PREFIX)
  const isGrok = GROK_API_KEY && m.message.startsWith(GROK_PREFIX)
  const isClaude = CLAUDE_API_KEY && m.message.startsWith(CLAUDE_PREFIX)
  if (!isDeepseek && !isGemini && !isGPT && !isGrok && !isClaude) return

  // 发送回执（也区分私聊/公开）
  try {
    if (m.whisper) {
      bot.whisper(m.username, '已收到，正在思考')
    } else {
      bot.chat('已收到，正在思考')
    }
  } catch (e) { console.warn('发送回执失败', e) }

  const query = isDeepseek
    ? m.message.slice(DEEPSEEK_PREFIX.length)
    : isGemini
    ? m.message.slice(GEMINI_PREFIX.length)
    : isGPT
    ? m.message.slice(GPT_PREFIX.length)
    : isGrok
    ? m.message.slice(GROK_PREFIX.length)
    : m.message.slice(CLAUDE_PREFIX.length)

  try {
    let data, replyText

    if (isDeepseek) {
      data = await callDeepseek(query, m.username)
      if (data?.usage?.total_tokens) {
        TOTAL_TOKENS_USED += data.usage.total_tokens
        DEEPSEEK_CALLS++
      }
      replyText = data?.choices?.[0]?.message?.content || JSON.stringify(data)
    } else if (isGemini) {
      data = await callGemini(query, m.username)
      if (data?.usage?.total_tokens) {
        TOTAL_TOKENS_USED += data.usage.total_tokens
        GEMINI_CALLS++
      }
      replyText = data?.choices?.[0]?.message?.content || JSON.stringify(data)
    } else if (isGPT) {
      data = await callGPT(query, m.username)
      if (data?.usage?.total_tokens) {
        TOTAL_TOKENS_USED += data.usage.total_tokens
        GPT_CALLS++
      }
      replyText = data?.choices?.[0]?.message?.content || JSON.stringify(data)
    } else if (isGrok) {
      data = await callGrok(query, m.username)
      if (data?.usage?.total_tokens) {
        TOTAL_TOKENS_USED += data.usage.total_tokens
        GROK_CALLS++
      }
      replyText = data?.choices?.[0]?.message?.content || JSON.stringify(data)
    } else {
      data = await callClaude(query, m.username)
      if (data?.usage?.total_tokens) {
        TOTAL_TOKENS_USED += data.usage.total_tokens
        CLAUDE_CALLS++
      }
      replyText = data?.choices?.[0]?.message?.content || JSON.stringify(data)
    }

    replyText = (replyText || '').trim() || '(空回复)'
    await handleReply(replyText, m.username, m.whisper)

  } catch (err) {
    const modelName = isDeepseek ? 'Deepseek' : (isGemini ? 'Gemini' : (isGPT ? 'GPT' : (isGrok ? 'Grok' : 'Claude')))
    console.error(`[${modelName}] 请求错误:`, err)
    try {
      const errMsg = `${modelName} 请求失败: ` + String(err).slice(0, 100)
      if (m.whisper) {
        bot.whisper(m.username, errMsg)
      } else {
        bot.chat(errMsg)
      }
    } catch (e) {}
  }
}

// ==================== 定时器：处理消息缓存（并发）====================
setInterval(() => {
  if (chatBuffer.length === 0) return
  const messages = chatBuffer.splice(0, chatBuffer.length)

  for (const m of messages) {
    // 并发处理每条消息，不等待
    processMessage(m).catch(err => {
      console.error('处理消息时出现未捕获错误:', err)
    })
  }
}, 2000)

// ==================== 退出时打印统计 ====================
function printTokenUsageAndExit(code) {
  console.log('\n========== Token 使用统计 ==========')
  console.log('Deepseek 调用次数:', DEEPSEEK_CALLS)
  console.log('Gemini 调用次数:', GEMINI_CALLS)
  console.log('GPT 调用次数:', GPT_CALLS)
  console.log('Grok 调用次数:', GROK_CALLS)
  console.log('Claude 调用次数:', CLAUDE_CALLS)
  console.log('累计 token (五者合计):', TOTAL_TOKENS_USED)
  console.log('=====================================\n')
  if (typeof code !== 'undefined') process.exit(code)
}

process.on('SIGINT', () => { console.log('捕获 SIGINT'); printTokenUsageAndExit(0) })
process.on('SIGTERM', () => { console.log('捕获 SIGTERM'); printTokenUsageAndExit(0) })
process.on('exit', printTokenUsageAndExit)

// ==================== 启动机器人 ====================
loadBanList()  // 加载黑名单
createBotInstance()