const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
// 从环境变量读取端口，默认 3000（可通过 .env 中的 WEB_PORT 覆盖）
const PORT = process.env.WEB_PORT || 3000;

// ==================== 认证配置 ====================
const WEB_USERNAME = process.env.WEB_USERNAME;
const WEB_PASSWORD = process.env.WEB_PASSWORD;

// 判断是否需要认证（两者都存在且非空）
const needAuth = WEB_USERNAME && WEB_PASSWORD && WEB_USERNAME.trim() !== '' && WEB_PASSWORD.trim() !== '';

// 自定义 Basic Auth 中间件
function basicAuth(req, res, next) {
    if (!needAuth) return next();
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
        // 未提供认证头，要求客户端认证
        res.set('WWW-Authenticate', 'Basic realm="MC Bot Configuration"');
        return res.status(401).send('Authentication required.');
    }

    // 解码 Base64 凭证
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8');
    const [username, password] = credentials.split(':');

    // 比对用户名和密码（trim 后比较，避免空格问题）
    if (username.trim() === WEB_USERNAME.trim() && password.trim() === WEB_PASSWORD.trim()) {
        return next();
    } else {
        res.set('WWW-Authenticate', 'Basic realm="MC Bot Configuration"');
        return res.status(401).send('Invalid credentials.');
    }
}

// 应用认证中间件（在所有路由之前）
app.use(basicAuth);

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==================== 友好名称映射 ====================
const friendlyNames = {
    // Minecraft 服务器连接
    MC_HOST: '服务器地址',
    MC_PORT: '服务器端口',
    MC_USERNAME: '机器人用户名',
    MC_INITIAL_ACTION: '初始动作',
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
    ADMIN_NAME: '游戏管理员',
    BOT_ADMIN: '机器人管理员',
    WEB_PORT: 'Web 端口',
    WEB_USERNAME: 'Web 用户名',
    WEB_PASSWORD: 'Web 密码',
    CHAT_DELAY_MS: '聊天延迟(ms)',
};

// ==================== 配置 API ====================
const ENV_FILE = path.join(__dirname, '.env');

// 解析 .env 文件
function parseEnvFile() {
    const env = {};
    try {
        const content = fs.readFileSync(ENV_FILE, 'utf8');
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
        // 文件不存在返回空
    }
    return env;
}

// 写入 .env 文件
function writeEnvFile(newValues) {
    const lines = [];
    for (const [key, value] of Object.entries(newValues)) {
        const needsQuotes = value.includes(' ') || value.includes('#') || value.includes('=');
        const formattedValue = needsQuotes ? `"${value}"` : value;
        lines.push(`${key}=${formattedValue}`);
    }
    fs.writeFileSync(ENV_FILE, lines.join('\n'), 'utf8');
}

// ==================== API 路由 ====================

// 获取配置
app.get('/api/config', (req, res) => {
    const env = parseEnvFile();
    const configs = Object.keys(env).map(key => ({
        key,
        value: env[key],
        friendlyName: friendlyNames[key] || key,
    }));

    res.json({ configs });
});

// 保存配置
app.post('/api/config', (req, res) => {
    const newValues = req.body;
    try {
        writeEnvFile(newValues);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== 日志相关 API ====================
const LOG_DIR = path.join(__dirname, 'logs');

app.get('/api/logs', (req, res) => {
    fs.readdir(LOG_DIR, (err, files) => {
        if (err) return res.status(500).json({ error: '无法读取日志目录' });
        const logFiles = files
            .filter(f => f.endsWith('.log'))
            .map(f => ({ name: f, size: fs.statSync(path.join(LOG_DIR, f)).size }))
            .sort((a, b) => b.name.localeCompare(a.name));
        res.json(logFiles);
    });
});

app.get('/api/logs/:filename', (req, res) => {
    const filename = req.params.filename;
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ error: '非法文件名' });
    }
    const filePath = path.join(LOG_DIR, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: '文件不存在' });

    const page = parseInt(req.query.page) || 1;
    const size = parseInt(req.query.size) || 100;
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: '读取文件失败' });
        const lines = data.split('\n').filter(line => line.trim() !== '');
        const totalLines = lines.length;
        const start = (page - 1) * size;
        const end = start + size;
        const pageLines = lines.slice(start, end);
        res.json({ filename, totalLines, page, size, lines: pageLines });
    });
});

app.post('/api/logs/:filename/clear', (req, res) => {
    const filename = req.params.filename;
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ error: '非法文件名' });
    }
    const filePath = path.join(LOG_DIR, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: '文件不存在' });
    fs.writeFile(filePath, '', 'utf8', (err) => {
        if (err) return res.status(500).json({ error: '清空失败' });
        res.json({ success: true });
    });
});

// ==================== 远程命令执行 ====================
app.post('/api/execute', async (req, res) => {
    const portFile = path.join(__dirname, '.bot_port');
    let botApiPort = null;
    if (fs.existsSync(portFile)) {
        try {
            botApiPort = parseInt(fs.readFileSync(portFile, 'utf8').trim(), 10);
        } catch (e) {}
    }
    if (!botApiPort) {
        return res.status(503).json({ error: 'Bot 内部 API 未就绪' });
    }

    const { command, type } = req.body;
    if (!command) return res.status(400).json({ error: '缺少命令' });

    try {
        const response = await fetch(`http://127.0.0.1:${botApiPort}/api/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command, type })
        });
        const data = await response.json();
        res.status(response.status).json(data);
    } catch (err) {
        res.status(500).json({ error: '无法连接到 Bot 内部 API' });
    }
});

// ==================== 前端页面 ====================
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

app.get('/logs', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>日志查看 - MC Bot</title>
    <style>
        body { font-family: Arial; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: auto; background: white; padding: 20px; border-radius: 8px; }
        h1 { text-align: center; }
        .file-list { margin-bottom: 20px; }
        .file-list select { width: 300px; padding: 5px; }
        .log-content { background: #1e1e1e; color: #d4d4d4; padding: 10px; border-radius: 4px; font-family: monospace; height: 500px; overflow-y: auto; white-space: pre-wrap; }
        .controls { margin: 10px 0; }
        button { padding: 5px 10px; margin-right: 5px; }
        .pagination { margin-top: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📋 日志查看器</h1>
        <div class="file-list">
            <label>选择日志文件：</label>
            <select id="fileSelect" onchange="loadLogFile()"></select>
            <button onclick="refreshFileList()">刷新列表</button>
            <button onclick="clearCurrentLog()" style="background:#ff4444;color:white;">清空当前日志</button>
        </div>
        <div class="controls">
            <button onclick="prevPage()">上一页</button>
            <span id="pageInfo">第 1 页</span>
            <button onclick="nextPage()">下一页</button>
            <input type="number" id="pageSize" value="100" min="1" style="width:60px;"> 行/页
            <button onclick="loadLogFile()">跳转</button>
            <button onclick="downloadLog()">下载日志</button>
        </div>
        <div class="log-content" id="logContent">请选择日志文件</div>
    </div>

    <script>
        let currentFile = '';
        let currentPage = 1;
        let pageSize = 100;
        let totalLines = 0;

        async function refreshFileList() {
            const res = await fetch('/api/logs');
            const files = await res.json();
            const select = document.getElementById('fileSelect');
            select.innerHTML = files.map(f => \`<option value="\${f.name}">\${f.name} (\${(f.size/1024).toFixed(2)} KB)</option>\`).join('');
            if (files.length > 0) {
                currentFile = files[0].name;
                loadLogFile();
            }
        }

        async function loadLogFile() {
            const select = document.getElementById('fileSelect');
            currentFile = select.value || currentFile;
            if (!currentFile) return;

            pageSize = parseInt(document.getElementById('pageSize').value) || 100;
            const url = \`/api/logs/\${encodeURIComponent(currentFile)}?page=\${currentPage}&size=\${pageSize}\`;
            const res = await fetch(url);
            const data = await res.json();
            if (res.ok) {
                totalLines = data.totalLines;
                document.getElementById('logContent').innerText = data.lines.join('\\n') || '（空）';
                document.getElementById('pageInfo').innerText = \`第 \${data.page} 页 / 共 \${Math.ceil(totalLines/pageSize)} 页 (\${totalLines} 行)\`;
            } else {
                alert('加载失败：' + data.error);
            }
        }

        function prevPage() {
            if (currentPage > 1) {
                currentPage--;
                loadLogFile();
            }
        }

        function nextPage() {
            currentPage++;
            loadLogFile();
        }

        async function clearCurrentLog() {
            if (!currentFile || !confirm('确定要清空该日志文件吗？')) return;
            const res = await fetch(\`/api/logs/\${encodeURIComponent(currentFile)}/clear\`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                alert('已清空');
                loadLogFile();
            } else {
                alert('清空失败：' + data.error);
            }
        }

        function downloadLog() {
            if (!currentFile) return;
            fetch(\`/api/logs/\${encodeURIComponent(currentFile)}\`).then(res => res.blob()).then(blob => {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = currentFile;
                a.click();
            });
        }

        refreshFileList();
        setInterval(refreshFileList, 10000);
    </script>
</body>
</html>
    `);
});

app.get('/control', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>远程控制 - MC Bot</title>
    <style>
        body { font-family: Arial; margin: 20px; background: #f5f5f5; }
        .container { max-width: 800px; margin: auto; background: white; padding: 20px; border-radius: 8px; }
        h1 { text-align: center; }
        .form-group { margin-bottom: 15px; }
        label { display: block; font-weight: bold; margin-bottom: 5px; }
        input[type=text] { width: 100%; padding: 8px; font-size: 16px; }
        select { padding: 8px; font-size: 16px; }
        button { padding: 10px 20px; font-size: 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #45a049; }
        .history { margin-top: 20px; border-top: 1px solid #ddd; padding-top: 10px; }
        .history-item { background: #f0f0f0; padding: 5px; margin-bottom: 5px; border-radius: 4px; font-family: monospace; }
        .error { color: red; }
        .success { color: green; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎮 远程控制机器人</h1>
        <div class="form-group">
            <label>命令类型</label>
            <select id="cmdType">
                <option value="chat">💬 发言（普通聊天）</option>
                <option value="cmd">⚡ 执行命令（自动加 /）</option>
            </select>
        </div>
        <div class="form-group">
            <label>命令内容</label>
            <input type="text" id="cmdInput" placeholder="例如: /give @p diamond 1 或 大家好" autofocus>
        </div>
        <button onclick="sendCommand()">发送</button>
        <div id="result" style="margin-top:10px;"></div>
        <div class="history">
            <h3>历史记录</h3>
            <div id="historyList"></div>
        </div>
    </div>

    <script>
        let history = [];

        async function sendCommand() {
            const type = document.getElementById('cmdType').value;
            const command = document.getElementById('cmdInput').value.trim();
            if (!command) return;

            const res = await fetch('/api/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command, type })
            });
            const result = await res.json();
            const resultDiv = document.getElementById('result');
            if (res.ok) {
                resultDiv.innerHTML = '<span class="success">✅ 命令已发送</span>';
                history.unshift({ type, command, time: new Date().toLocaleTimeString() });
                if (history.length > 10) history.pop();
                renderHistory();
                document.getElementById('cmdInput').value = '';
            } else {
                resultDiv.innerHTML = '<span class="error">❌ ' + (result.error || '发送失败') + '</span>';
            }
        }

        function renderHistory() {
            const list = document.getElementById('historyList');
            list.innerHTML = history.map(h => \`
                <div class="history-item">[\${h.time}] [\${h.type === 'chat' ? '💬' : '⚡'}] \${h.command}</div>
            \`).join('');
        }

        document.getElementById('cmdInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendCommand();
        });
    </script>
</body>
</html>
    `);
});
// 启动 Web 服务器
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Web 配置界面运行在 http://0.0.0.0:${PORT}`);
    console.log(`日志查看: http://0.0.0.0:${PORT}/logs`);
    console.log(`远程控制: http://0.0.0.0:${PORT}/control`);
});