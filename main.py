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

def signal_handler(signum, frame):
    print('\nReceived signal, waiting for bot and web to exit gracefully...')
    global proc_bot, proc_web

    # 等待最多 5 秒让子进程自行退出
    for _ in range(5):
        if proc_bot is not None and proc_bot.poll() is not None and \
           proc_web is not None and proc_web.poll() is not None:
            break
        time.sleep(1)

    # 如果还有未退出的，强制终止
    if proc_bot is not None and proc_bot.poll() is None:
        proc_bot.terminate()
    if proc_web is not None and proc_web.poll() is None:
        proc_web.terminate()

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

    if not os.path.exists(bot_script):
        print('Error: bot.js not found next to main.py')
        sys.exit(1)
    if not os.path.exists(web_script):
        print('Error: web.js not found next to main.py')
        sys.exit(1)

    print('Starting Node.js bot (bot.js) and web interface (web.js)...')

    global proc_bot, proc_web
    proc_bot = subprocess.Popen(['node', bot_script], env=child_env)
    proc_web = subprocess.Popen(['node', web_script], env=child_env)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # 等待任一进程结束
    while True:
        bot_ret = proc_bot.poll()
        web_ret = proc_web.poll()
        if bot_ret is not None or web_ret is not None:
            print('One of the processes exited, terminating the other...')
            if bot_ret is None:
                proc_bot.terminate()
            if web_ret is None:
                proc_web.terminate()
            break
        time.sleep(0.5)

    # 等待两个进程完全退出
    proc_bot.wait()
    proc_web.wait()
    print('Bot and web interface stopped.')

if __name__ == '__main__':
    main()