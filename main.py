# -*- coding: utf-8 -*-
import os
import subprocess
import sys
import shutil
import signal
import time

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
    # 检查 node 是否可用
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

def main():
    # 如果存在则加载 .env
    env = load_dotenv('.env')
    # 合并到子进程的环境变量
    child_env = os.environ.copy()
    child_env.update(env)

    ensure_node_deps()

    # 脚本所在目录
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

    # 启动两个子进程
    proc_bot = subprocess.Popen(['node', bot_script], env=child_env)
    proc_web = subprocess.Popen(['node', web_script], env=child_env)

    # 定义信号处理函数，用于终止子进程
    def terminate_processes(signum, frame):
        print('\nReceived signal, terminating bot and web...')
        proc_bot.terminate()
        proc_web.terminate()
        # 等待进程结束
        proc_bot.wait()
        proc_web.wait()
        sys.exit(0)

    signal.signal(signal.SIGINT, terminate_processes)
    signal.signal(signal.SIGTERM, terminate_processes)

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