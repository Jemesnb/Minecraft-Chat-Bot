# -*- coding: utf-8 -*-
import os
import subprocess
import sys
import shutil
import signal
import time
import threading
from datetime import datetime

# 全局进程对象，供信号处理函数使用
proc_bot = None
proc_web = None
proc_bridge = None  # QQ 桥接进程

# ==================== 启动器日志 ====================
LOG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'logs')
os.makedirs(LOG_DIR, exist_ok=True)
_log_lock = threading.Lock()

def _log_file():
    """返回当天的启动器日志文件路径。"""
    return os.path.join(LOG_DIR, f'launcher-{datetime.now().strftime("%Y-%m-%d")}.log')

def launcher_log(tag, message, level='INFO'):
    """写一行启动器日志：[时间] [级别] [tag] message，同时打印到控制台。"""
    line = f'[{datetime.now().isoformat()}] [{level}] [{tag}] {message}'
    with _log_lock:
        try:
            with open(_log_file(), 'a', encoding='utf-8') as f:
                f.write(line + '\n')
        except Exception as e:
            print(f'[launcher] 写日志失败: {e}')
    print(line, flush=True)

def _stream_reader(proc, tag):
    """逐行读取子进程输出，加前缀写入启动器日志并打印。"""
    try:
        for raw in iter(proc.stdout.readline, b''):
            if not raw:
                break
            try:
                text = raw.decode('utf-8', errors='replace').rstrip('\r\n')
            except Exception:
                text = repr(raw)
            if text:
                launcher_log(tag, text)
    except Exception as e:
        launcher_log(tag, f'读取输出线程异常: {e}', level='ERROR')
    finally:
        try:
            proc.stdout.close()
        except Exception:
            pass

def load_dotenv(path='.env'):
    if not os.path.exists(path):
        return {}
    env = {}
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env

def ensure_node_deps():
    if not shutil.which('node'):
        print('Error: node is not installed or not in PATH. Please install Node.js.')
        sys.exit(1)

    # 检查 npm 是否可用（Windows 上可能是 npm.cmd）
    npm_cmd = shutil.which('npm')
    if not npm_cmd:
        print('Error: npm is not installed or not in PATH. Please install Node.js (which includes npm).')
        sys.exit(1)

    # 如果 node_modules 不存在，运行 npm install
    if not os.path.exists('node_modules'):
        print('Installing Node.js dependencies (npm install)...')
        try:
            subprocess.check_call([npm_cmd, 'install'])
        except subprocess.CalledProcessError:
            print('npm install failed. Please run `npm install` manually and re-run this script.')
            sys.exit(1)

    # 检查 express 是否已安装，若未安装则自动安装
    if not os.path.exists('node_modules/express'):
        print('Installing express for web interface...')
        try:
            subprocess.check_call([npm_cmd, 'install', 'express', 'body-parser'])
        except subprocess.CalledProcessError:
            print('Failed to install express. Please run `npm install express body-parser` manually.')
            sys.exit(1)

    # 安装桥接服务所需的额外依赖（axios, dotenv）
    # 如果已安装则跳过
    if not os.path.exists('node_modules/axios') or not os.path.exists('node_modules/dotenv'):
        print('Installing additional dependencies for QQ bridge (axios, dotenv)...')
        try:
            subprocess.check_call([npm_cmd, 'install', 'axios', 'dotenv'])
        except subprocess.CalledProcessError:
            print('Failed to install axios/dotenv. Please run `npm install axios dotenv` manually.')
            sys.exit(1)

def signal_handler(signum, frame):
    print('\nReceived signal, waiting for bot and web to exit gracefully...')
    global proc_bot, proc_web, proc_bridge

    # 等待最多 5 秒让子进程自行退出
    for _ in range(5):
        if (proc_bot is None or proc_bot.poll() is not None) and \
           (proc_web is None or proc_web.poll() is not None) and \
           (proc_bridge is None or proc_bridge.poll() is not None):
            break
        time.sleep(1)

    # 如果还有未退出的，强制终止
    if proc_bot is not None and proc_bot.poll() is None:
        proc_bot.terminate()
    if proc_web is not None and proc_web.poll() is None:
        proc_web.terminate()
    if proc_bridge is not None and proc_bridge.poll() is None:
        proc_bridge.terminate()

    sys.exit(0)

def main():
    # 加载 .env
    env = load_dotenv('.env')
    child_env = os.environ.copy()
    child_env.update(env)

    ensure_node_deps()

    base_dir = os.path.dirname(__file__)
    bot_script = os.path.join(base_dir, 'bot.js')
    web_script = os.path.join(base_dir, 'web.js')
    bridge_script = os.path.join(base_dir, 'qq-bridge.js')

    if not os.path.exists(bot_script):
        print('Error: bot.js not found next to main.py')
        sys.exit(1)
    if not os.path.exists(web_script):
        print('Error: web.js not found next to main.py')
        sys.exit(1)
    # 检查桥接脚本是否存在（可选）
    bridge_exists = os.path.exists(bridge_script)

    launcher_log('LAUNCHER', '启动 Node.js bot (bot.js) 与 web 界面 (web.js)...')
    if bridge_exists:
        launcher_log('LAUNCHER', '启动 QQ 桥接 (qq-bridge.js)...')

    global proc_bot, proc_web, proc_bridge
    # 子进程输出统一捕获：stdout 合并 stderr，逐行打 tag 写入 launcher 日志
    proc_bot = subprocess.Popen(
        ['node', bot_script], env=child_env,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT
    )
    threading.Thread(target=_stream_reader, args=(proc_bot, 'bot'), daemon=True).start()
    proc_web = subprocess.Popen(
        ['node', web_script], env=child_env,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT
    )
    threading.Thread(target=_stream_reader, args=(proc_web, 'web'), daemon=True).start()
    if bridge_exists:
        proc_bridge = subprocess.Popen(
            ['node', bridge_script], env=child_env,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT
        )
        threading.Thread(target=_stream_reader, args=(proc_bridge, 'bridge'), daemon=True).start()

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # 监控进程状态，但不再因单个进程退出而终止另一个
    while True:
        bot_ret = proc_bot.poll() if proc_bot else None
        web_ret = proc_web.poll() if proc_web else None
        bridge_ret = proc_bridge.poll() if proc_bridge else None

        # 如果所有进程都已退出（或已被置为 None），结束循环
        if (proc_bot is None or bot_ret is not None) and \
           (proc_web is None or web_ret is not None) and \
           (proc_bridge is None or bridge_ret is not None):
            break

        # 如果 bot 进程退出，记录日志并释放引用（不终止其他进程）
        if proc_bot and bot_ret is not None:
            level = 'CRASH' if bot_ret != 0 else 'INFO'
            launcher_log('bot', f'进程退出，code={bot_ret}，其他进程继续运行', level=level)
            if bot_ret != 0:
                launcher_log('bot', '崩溃堆栈详见 logs/crash-*.log', level='CRASH')
            proc_bot = None

        # 如果 web 进程退出，记录日志并释放引用（不终止其他进程）
        if proc_web and web_ret is not None:
            level = 'CRASH' if web_ret != 0 else 'INFO'
            launcher_log('web', f'进程退出，code={web_ret}，其他进程继续运行', level=level)
            if web_ret != 0:
                launcher_log('web', '崩溃堆栈详见 logs/crash-*.log', level='CRASH')
            proc_web = None

        # 如果桥接进程退出，记录日志并释放引用（不终止其他进程）
        if proc_bridge and bridge_ret is not None:
            level = 'CRASH' if bridge_ret != 0 else 'INFO'
            launcher_log('bridge', f'进程退出，code={bridge_ret}，其他进程继续运行', level=level)
            if bridge_ret != 0:
                launcher_log('bridge', '崩溃堆栈详见 logs/crash-*.log', level='CRASH')
            proc_bridge = None

        time.sleep(0.5)

    # 等待所有进程完全退出（如果它们还存在）
    if proc_bot and proc_bot.poll() is None:
        proc_bot.wait()
    if proc_web and proc_web.poll() is None:
        proc_web.wait()
    if proc_bridge and proc_bridge.poll() is None:
        proc_bridge.wait()

    launcher_log('LAUNCHER', '所有子进程已停止')

if __name__ == '__main__':
    main()