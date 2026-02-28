const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
// 从环境变量读取端口，默认 3000（可通过 .env 中的 WEB_PORT 覆盖）
const PORT = process.env.WEB_PORT || 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public'))); // 可选静态文件目录

// ==================== 中文友好名称映射 ====================
const friendlyNames = {
    // Minecraft 服务器连接
    MC_HOST: '服务器地址',
    MC_PORT: '服务器端口',
    MC_USERNAME: '机器人用户名',
    MC_INITIAL_ACTION: '初始动作（登录后自动发送）',
    // Deepseek API
    DEEPSEEK_API_KEY: 'Deepseek API 密钥',
    DEEPSEEK_ENDPOINT: 'Deepseek 端点',
    DEEPSEEK_PATH: 'Deepseek 路径',
    // Gemini API
    GEMINI_API_KEY: 'Gemini API 密钥',
    GEMINI_ENDPOINT: 'Gemini 端点',
    GEMINI_PATH: 'Gemini 路径',
    GEMINI_MODEL: 'Gemini 模型',
    // ChatGPT API
    CHATGPT_API_KEY: 'ChatGPT API 密钥',
    CHATGPT_ENDPOINT: 'ChatGPT 端点',
    CHATGPT_PATH: 'ChatGPT 路径',
    CHATGPT_MODEL: 'ChatGPT 模型',
    // Grok API
    GROK_API_KEY: 'Grok API 密钥',
    GROK_ENDPOINT: 'Grok 端点',
    GROK_PATH: 'Grok 路径',
    GROK_MODEL: 'Grok 模型',
    // Claude API
    CLAUDE_API_KEY: 'Claude API 密钥',
    CLAUDE_ENDPOINT: 'Claude 端点',
    CLAUDE_PATH: 'Claude 路径',
    CLAUDE_MODEL: 'Claude 模型',
    // 管理员
    ADMIN_NAME: '游戏管理员名称（可执行命令）',
    BOT_ADMIN: '机器人管理员名称（可封禁玩家）',
    // Web 端口
    WEB_PORT: 'Web 管理端口',
    // 防刷屏
    CHAT_DELAY_MS: '聊天发送延迟（毫秒）',
};

// ==================== 文件操作函数 ====================

// 解析 .env 文件为对象
function parseEnvFile(filePath) {
    const env = {};
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        content.split('\n').forEach(line => {
            const match = line.match(/^\s*([^#=]+)\s*=\s*(.*?)\s*$/);
            if (match) {
                const key = match[1].trim();
                let value = match[2].trim();
                // 去除可能的引号
                if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
                if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
                env[key] = value;
            }
        });
    } catch (err) {
        // 文件不存在，返回空对象
    }
    return env;
}

// 解析 .env.example 获取所有变量名及其默认值
function parseExampleFile(filePath) {
    const items = []; // { key, defaultValue }
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        content.split('\n').forEach(line => {
            const match = line.match(/^\s*([^#=]+)\s*=\s*(.*?)\s*$/);
            if (match) {
                const key = match[1].trim();
                const defaultValue = match[2].trim();
                items.push({ key, defaultValue });
            }
        });
    } catch (err) {
        console.error('读取 .env.example 失败:', err);
    }
    return items;
}

// 写入 .env 文件（基于 .env.example 中的变量顺序）
function writeEnvFile(exampleItems, newValues) {
    const lines = [];
    // 先从 .env.example 读取原始内容以保留注释和格式
    try {
        const exampleContent = fs.readFileSync(path.join(__dirname, '.env.example'), 'utf8');
        const exampleLines = exampleContent.split('\n');
        for (const line of exampleLines) {
            const match = line.match(/^\s*([^#=]+)\s*=\s*(.*?)\s*$/);
            if (match) {
                const key = match[1].trim();
                const value = newValues[key] !== undefined ? newValues[key] : match[2].trim();
                // 如果值包含空格或特殊字符，用双引号包裹
                const needsQuotes = value.includes(' ') || value.includes('#') || value.includes('=');
                const formattedValue = needsQuotes ? `"${value}"` : value;
                lines.push(`${key}=${formattedValue}`);
            } else {
                // 注释或空行，原样保留
                lines.push(line);
            }
        }
    } catch (err) {
        // 如果 .env.example 不存在，则直接根据 exampleItems 生成简单文件
        console.error('无法读取 .env.example，将基于变量列表生成 .env');
        for (const item of exampleItems) {
            const key = item.key;
            const value = newValues[key] !== undefined ? newValues[key] : item.defaultValue;
            const needsQuotes = value.includes(' ') || value.includes('#') || value.includes('=');
            const formattedValue = needsQuotes ? `"${value}"` : value;
            lines.push(`${key}=${formattedValue}`);
        }
    }
    fs.writeFileSync(path.join(__dirname, '.env'), lines.join('\n'), 'utf8');
}

// ==================== API 路由 ====================

// 获取配置
app.get('/api/config', (req, res) => {
    const envPath = path.join(__dirname, '.env');
    const examplePath = path.join(__dirname, '.env.example');

    const currentEnv = parseEnvFile(envPath);
    const exampleItems = parseExampleFile(examplePath);

    // 构建返回数据：每个配置项包含 key, value, friendlyName
    const configs = exampleItems.map(item => ({
        key: item.key,
        value: currentEnv[item.key] !== undefined ? currentEnv[item.key] : item.defaultValue,
        friendlyName: friendlyNames[item.key] || item.key, // 若无映射则显示变量名本身
    }));

    res.json({ configs });
});

// 保存配置
app.post('/api/config', (req, res) => {
    const newValues = req.body;
    const examplePath = path.join(__dirname, '.env.example');
    const exampleItems = parseExampleFile(examplePath);
    try {
        writeEnvFile(exampleItems, newValues);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 提供前端页面
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>MC Bot 配置编辑器</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 800px; margin: auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { text-align: center; color: #333; }
        .config-item { margin-bottom: 20px; }
        label { font-weight: bold; display: block; margin-bottom: 5px; color: #555; }
        input[type=text] { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
        .key-hint { color: #888; font-size: 0.9em; margin-left: 5px; font-weight: normal; }
        button { background: #4CAF50; color: white; border: none; padding: 12px 20px; font-size: 16px; border-radius: 4px; cursor: pointer; width: 100%; }
        button:hover { background: #45a049; }
        #status { margin-top: 15px; padding: 10px; border-radius: 4px; display: none; }
        .success { background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .error { background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
    </style>
</head>
<body>
    <div class="container">
        <h1>MC 机器人配置</h1>
        <form id="configForm">
            <div id="configs"></div>
            <button type="submit">保存配置</button>
        </form>
        <div id="status"></div>
    </div>

    <script>
        async function loadConfig() {
            const res = await fetch('/api/config');
            const data = await res.json();
            const container = document.getElementById('configs');
            container.innerHTML = '';
            data.configs.forEach(cfg => {
                const div = document.createElement('div');
                div.className = 'config-item';
                div.innerHTML = \`
                    <label>
                        \${cfg.friendlyName} <span class="key-hint">(\${cfg.key})</span>
                    </label>
                    <input type="text" name="\${cfg.key}" value="\${cfg.value.replace(/"/g, '&quot;')}">
                \`;
                container.appendChild(div);
            });
        }

        document.getElementById('configForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = {};
            for (let [key, value] of formData.entries()) {
                data[key] = value;
            }
            const res = await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            const statusDiv = document.getElementById('status');
            statusDiv.style.display = 'block';
            if (result.success) {
                statusDiv.className = 'success';
                statusDiv.textContent = '配置已保存！';
            } else {
                statusDiv.className = 'error';
                statusDiv.textContent = '保存失败：' + (result.error || '未知错误');
            }
            setTimeout(() => { statusDiv.style.display = 'none'; }, 3000);
        });

        loadConfig();
    </script>
</body>
</html>
    `);
});

app.listen(PORT, 'localhost', () => {
    console.log(`Web 配置界面运行在 http://localhost:${PORT}`);
});