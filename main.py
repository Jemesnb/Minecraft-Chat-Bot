# -*- coding: utf-8 -*-
import os
import subprocess
import sys
import shutil
import signal
import time

# 全局进程对象，供信号处理函数使用
proc_bot = None
proc_web = None
proc_bridge = None  # QQ 桥接进程

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

    print('Starting Node.js bot (bot.js) and web interface (web.js)...')
    if bridge_exists:
        print('Starting QQ bridge (qq-bridge.js)...')

    global proc_bot, proc_web, proc_bridge
    proc_bot = subprocess.Popen(['node', bot_script], env=child_env)
    proc_web = subprocess.Popen(['node', web_script], env=child_env)
    if bridge_exists:
        proc_bridge = subprocess.Popen(['node', bridge_script], env=child_env)

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
            print(f'Bot process exited with code {bot_ret}, but others continue.')
            proc_bot = None

        # 如果 web 进程退出，记录日志并释放引用（不终止其他进程）
        if proc_web and web_ret is not None:
            print(f'Web process exited with code {web_ret}, but others continue.')
            proc_web = None

        # 如果桥接进程退出，记录日志并释放引用（不终止其他进程）
        if proc_bridge and bridge_ret is not None:
            print(f'Bridge process exited with code {bridge_ret}, but others continue.')
            proc_bridge = None

        time.sleep(0.5)

    # 等待所有进程完全退出（如果它们还存在）
    if proc_bot and proc_bot.poll() is None:
        proc_bot.wait()
    if proc_web and proc_web.poll() is None:
        proc_web.wait()
    if proc_bridge and proc_bridge.poll() is None:
        proc_bridge.wait()

    print('Bot and web interface stopped.')

if __name__ == '__main__':
    main()