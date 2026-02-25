# -*- coding: utf-8 -*-
import os
import subprocess
import sys
import shutil

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
    if not os.path.exists('node_modules'):
        print('Installing Node.js dependencies (npm install)...')
        try:
            subprocess.check_call(['npm', 'install'])
        except subprocess.CalledProcessError:
            print('npm install failed. Please run `npm install` manually and re-run this script.')
            sys.exit(1)


def main():
    # 如果存在则加载 .env
    env = load_dotenv('.env')
    # 合并到子进程的环境变量
    child_env = os.environ.copy()
    child_env.update(env)

    # 示例内联变量（取消注释并编辑以使用内联值而不是环境变量）：
    # child_env.setdefault('MC_HOST', 'localhost')
    # child_env.setdefault('MC_PORT', '25565')
    # child_env.setdefault('MC_USERNAME', 'DeepBot')
    # child_env.setdefault('MC_ONLINE', 'false')
    # child_env.setdefault('MC_INITIAL_ACTION', '')
    # child_env.setdefault('DEEPSEEK_API_KEY', '')
    # child_env.setdefault('DEEPSEEK_ENDPOINT', 'https://api.deepseek.com')

    ensure_node_deps()

    node_script = os.path.join(os.path.dirname(__file__), 'bot.js')
    if not os.path.exists(node_script):
        print('Error: bot.js not found next to main.py')
        sys.exit(1)

    print('Starting Node.js bot (bot.js)...')
    try:
        proc = subprocess.Popen(['node', node_script], env=child_env)
        proc.wait()
    except KeyboardInterrupt:
        print('Interrupted, terminating bot...')
        try:
            proc.terminate()
        except Exception:
            pass


if __name__ == '__main__':
    main()
