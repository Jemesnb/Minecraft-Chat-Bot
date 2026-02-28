const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.WEB_PORT || 3000; // 可通过环境变量自定义端口

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public'))); // 如果需要静态文件，可创建 public 文件夹

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
        // 文件不存在返回空对象
    }
    return env;
}

// 解析 .env.example 获取配置项顺序和注释
function parseExampleFile(filePath) {
    const lines = [];
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const rawLines = content.split('\n');
        for (let i = 0; i < rawLines.length; i++) {
            const line = rawLines[i];
            const trimmed = line.trim();
            if (trimmed === '' || trimmed.startsWith('#')) {
                // 注释或空行
                lines.push({ type: 'comment', content: line });
            } else {
                // 键值行
                const match = line.match(/^\s*([^#=]+)\s*=\s*(.*?)\s*$/);
                if (match) {
                    const key = match[1].trim();
                    const defaultValue = match[2].trim();
                    lines.push({ type: 'key', key, defaultValue, raw: line });
                } else {
                    // 无法解析的行，作为注释保留
                    lines.push({ type: 'comment', content: line });
                }
            }
        }
    } catch (err) {
        console.error('读取 .env.example 失败:', err);
    }
    return lines;
}

// 写入 .env 文件（基于 .env.example 模板）
function writeEnvFile(lines, newValues) {
    const output = [];
    for (const item of lines) {
        if (item.type === 'comment') {
            output.push(item.content);
        } else if (item.type === 'key') {
            const key = item.key;
            const value = newValues[key] !== undefined ? newValues[key] : item.defaultValue;
            // 如果值包含空格或特殊字符，用双引号包裹
            const needsQuotes = value.includes(' ') || value.includes('#') || value.includes('=');
            const formattedValue = needsQuotes ? `"${value}"` : value;
            output.push(`${key}=${formattedValue}`);
        }
    }
    fs.writeFileSync(path.join(__dirname, '.env'), output.join('\n'), 'utf8');
}

// API 获取配置
app.get('/api/config', (req, res) => {
    const envPath = path.join(__dirname, '.env');
    const examplePath = path.join(__dirname, '.env.example');

    const currentEnv = parseEnvFile(envPath);
    const exampleLines = parseExampleFile(examplePath);

    // 构建返回数据：每个配置项包含 key, value, comment
    const configs = [];
    for (const item of exampleLines) {
        if (item.type === 'key') {
            configs.push({
                key: item.key,
                value: currentEnv[item.key] !== undefined ? currentEnv[item.key] : item.defaultValue,
                comment: '' // 注释已单独作为 comment 行，此处简化
            });
        }
    }
    res.json({ configs, rawLines: exampleLines }); // 也返回 rawLines 供前端参考
});

// API 保存配置
app.post('/api/config', (req, res) => {
    const newValues = req.body;
    const examplePath = path.join(__dirname, '.env.example');
    const exampleLines = parseExampleFile(examplePath);
    try {
        writeEnvFile(exampleLines, newValues);
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
        body { font-family: Arial, sans-serif; margin: 20px; }
        .config-item { margin-bottom: 15px; }
        label { font-weight: bold; display: block; }
        input[type=text] { width: 100%; max-width: 600px; padding: 5px; }
        .comment { color: #666; font-size: 0.9em; margin-top: 2px; }
        button { padding: 10px 20px; font-size: 16px; }
        #status { margin-top: 10px; color: green; }
    </style>
</head>
<body>
    <h1>MC Bot 配置编辑器</h1>
    <form id="configForm">
        <div id="configs"></div>
        <button type="submit">保存配置</button>
    </form>
    <div id="status"></div>

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
                    <label for="\${cfg.key}">\${cfg.key}</label>
                    <input type="text" id="\${cfg.key}" name="\${cfg.key}" value="\${cfg.value.replace(/"/g, '&quot;')}">
                    <div class="comment">\${cfg.comment || ''}</div>
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
            const status = document.getElementById('status');
            if (result.success) {
                status.style.color = 'green';
                status.textContent = '配置已保存！';
            } else {
                status.style.color = 'red';
                status.textContent = '保存失败：' + result.error;
            }
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