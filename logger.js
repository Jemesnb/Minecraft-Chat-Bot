'use strict'
// ==================== 共享日志模块 ====================
// 三个 Node 进程（bot / web / bridge）共用本模块。
// 用法：const logger = require('./logger')('bot')
//
// 输出格式：[ISO时间] [LEVEL] [PROC] [CATEGORY] 内容
//   - 按进程分文件：logs/<proc>-YYYY-MM-DD.log
//   - 崩溃统一写：logs/crash-YYYY-MM-DD.log（整段一次写入，避免多进程交错）
//   - 自动注册 uncaughtException / unhandledRejection，崩溃必留堆栈
//   - 启动时按 LOG_RETENTION_DAYS 清理旧日志
//
// 配置（环境变量）：
//   LOG_LEVEL            控制台最低级别（DEBUG/INFO/WARN/ERROR），默认 INFO。文件始终写全量。
//   LOG_RETENTION_DAYS   旧日志保留天数，默认 14。设为 0 关闭清理。

const fs = require('fs')
const path = require('path')

const LOG_DIR = path.join(__dirname, 'logs')
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true })
}

const LEVELS = { DEBUG: 10, INFO: 20, WARN: 30, ERROR: 40 }
function levelNum(name) {
  return LEVELS[String(name || '').toUpperCase()] != null ? LEVELS[String(name).toUpperCase()] : 20
}
const CONSOLE_LEVEL = levelNum(process.env.LOG_LEVEL || 'INFO')

// 仅启动器进程不在此处理（Python 侧自己写 launcher 日志）；Node 进程都走这里。
let PROC_NAME = 'system'
let currentDate = ''
let logFile = ''

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function ensureFile() {
  const d = todayStr()
  if (d !== currentDate) {
    currentDate = d
    logFile = path.join(LOG_DIR, `${PROC_NAME}-${d}.log`)
  }
}

function crashFile() {
  return path.join(LOG_DIR, `crash-${todayStr()}.log`)
}

// 把任意参数序列化为字符串
function stringifyArgs(args) {
  return Array.from(args).map(arg => {
    if (arg == null) return String(arg)
    if (arg instanceof Error) return arg.stack || (arg.message || String(arg))
    if (typeof arg === 'string') return arg
    try { return JSON.stringify(arg) } catch (e) { return String(arg) }
  }).join(' ')
}

// 写入进程自己的日志文件（同步追加）
function writeToFile(level, category, content) {
  try {
    ensureFile()
    const ts = new Date().toISOString()
    const line = `[${ts}] [${level}] [${PROC_NAME}] [${category}] ${content}\n`
    fs.appendFileSync(logFile, line, { encoding: 'utf8' })
  } catch (e) {
    // 写日志本身失败只能吞掉，避免递归崩溃
  }
}

// 写入控制台（带级别过滤）
function writeToConsole(level, category, content) {
  const ts = new Date().toISOString()
  const line = `[${ts}] [${level}] [${PROC_NAME}] [${category}] ${content}`
  if (levelNum(level) >= CONSOLE_LEVEL) {
    if (level === 'ERROR') process.stderr.write(line + '\n')
    else if (level === 'WARN') process.stderr.write(line + '\n')
    else process.stdout.write(line + '\n')
  }
}

// 崩溃日志：整段一次写入共享文件
function writeCrash(type, err) {
  try {
    const ts = new Date().toISOString()
    const header = `\n========== [${ts}] [${PROC_NAME}] ${type} ==========\n`
    const body = (err && err.stack) ? err.stack : stringifyArgs([err])
    const footer = `\n---------- end ${type} ----------\n`
    fs.appendFileSync(crashFile(), header + body + footer, { encoding: 'utf8' })
  } catch (e) {
    // 忽略
  }
}

// 保留原始 console 方法
const originalLog = console.log
const originalWarn = console.warn
const originalError = console.error

function emit(level, category, args) {
  const content = stringifyArgs(args)
  writeToFile(level, category, content)
  writeToConsole(level, category, content)
}

// 主入口：require('./logger')('bot') 返回 logger 对象
function createLogger(procName) {
  PROC_NAME = procName || 'system'

  // 重写 console，接管全程序日志（默认分类 SYSTEM）
  console.log = function (...args) { emit('INFO', 'SYSTEM', args) }
  console.warn = function (...args) { emit('WARN', 'SYSTEM', args) }
  console.error = function (...args) { emit('ERROR', 'SYSTEM', args) }
  console.debug = function (...args) { emit('DEBUG', 'SYSTEM', args) }

  // 崩溃兜底：未捕获异常必留堆栈
  process.on('uncaughtException', (err) => {
    try { originalError('[CRASH] uncaughtException:', err && err.stack ? err.stack : err) } catch (e) {}
    writeCrash('uncaughtException', err)
    writeToFile('ERROR', 'CRASH', `uncaughtException: ${err && err.message ? err.message : err}`)
    // 给文件 flush 一点时间再退出
    setTimeout(() => process.exit(1), 100).unref()
  })
  process.on('unhandledRejection', (reason) => {
    try { originalError('[CRASH] unhandledRejection:', reason) } catch (e) {}
    const err = reason && reason.stack ? reason : new Error(stringifyArgs([reason]))
    writeCrash('unhandledRejection', err)
    writeToFile('ERROR', 'CRASH', `unhandledRejection: ${stringifyArgs([reason])}`)
  })

  cleanupOldLogs()

  return {
    // logger.log('NET', 'WARN', ...) 或 logger.log('NET', ...args)（默认 INFO）
    log(category, levelOrArg, ...rest) {
      if (typeof levelOrArg === 'string' && LEVELS[levelOrArg.toUpperCase()] != null) {
        emit(levelOrArg.toUpperCase(), category, rest)
      } else {
        // 第二个参数不是合法级别，按 INFO 处理，levelOrArg 也算内容
        emit('INFO', category, [levelOrArg, ...rest])
      }
    },
    debug(category, ...args) { emit('DEBUG', category, args) },
    info(category, ...args) { emit('INFO', category, args) },
    warn(category, ...args) { emit('WARN', category, args) },
    error(category, ...args) { emit('ERROR', category, args) },
    crash(type, err) { writeCrash(type, err) }
  }
}

// 清理过期日志
function cleanupOldLogs() {
  const retention = parseInt(process.env.LOG_RETENTION_DAYS || '14', 10)
  if (isNaN(retention) || retention <= 0) return
  const cutoff = Date.now() - retention * 24 * 60 * 60 * 1000
  let files
  try { files = fs.readdirSync(LOG_DIR) } catch (e) { return }
  for (const f of files) {
    if (!f.endsWith('.log')) continue
    const fp = path.join(LOG_DIR, f)
    try {
      const st = fs.statSync(fp)
      if (st.mtimeMs < cutoff) fs.unlinkSync(fp)
    } catch (e) { /* 忽略单个文件失败 */ }
  }
}

module.exports = createLogger
