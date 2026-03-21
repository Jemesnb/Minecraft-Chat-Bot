const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// ==================== 配置 ====================
const NAPCAT_API = process.env.NAPCAT_API || 'http://127.0.0.1:3000';
const QQ_GROUP_ID = parseInt(process.env.QQ_GROUP_ID, 10) || 0;
const BOT_QQ = parseInt(process.env.BOT_QQ, 10) || 0;
const BRIDGE_PORT = process.env.BRIDGE_PORT || 82;
const MC_USERNAME = process.env.MC_USERNAME || 'DeepBot';

// Minecraft 机器人内部 API 端口文件
const BOT_PORT_FILE = path.join(__dirname, '.bot_port');
let botApiPort = null;

// 读取 bot 内部 API 端口
function updateBotPort() {
    if (fs.existsSync(BOT_PORT_FILE)) {
        try {
            const port = parseInt(fs.readFileSync(BOT_PORT_FILE, 'utf8').trim(), 10);
            if (botApiPort !== port) {
                botApiPort = port;
                console.log(`[Bridge] 已获取 bot API 端口: ${botApiPort}`);
            }
        } catch (e) {
            console.error('[Bridge] 读取 .bot_port 失败:', e.message);
        }
    } else {
        console.warn('[Bridge] .bot_port 文件不存在，等待 bot 启动...');
    }
}
updateBotPort();
setInterval(updateBotPort, 5000);

// 向 Minecraft 机器人发送公开消息（QQ → MC）
async function sendToMinecraft(message) {
    if (!botApiPort) {
        console.warn('[Bridge] Bot API 端口未就绪，无法发送');
        return false;
    }
    const url = `http://127.0.0.1:${botApiPort}/api/execute`;
    const payload = {
        command: message,
        type: 'chat'
    };
    try {
        await axios.post(url, payload);
        console.log(`[Bridge] 已发送公开消息: ${message}`);
        return true;
    } catch (err) {
        console.error(`[Bridge] 发送公开消息失败:`, err.message);
        if (err.response) {
            console.error(`[Bridge] 响应状态: ${err.response.status}, 数据:`, err.response.data);
        }
        return false;
    }
}

// ==================== Express 服务 ====================
const app = express();
app.use(bodyParser.json());

// 接收来自 Minecraft 机器人的消息推送（MC → QQ）
app.post('/api/mc-message', async (req, res) => {
    const { username, message, isWhisper, time } = req.body;
    console.log(`[Bridge] 收到 Minecraft 消息: ${username}: ${message}`);

    // 过滤机器人自己的消息
    if (username === MC_USERNAME) {
        console.log('[Bridge] 忽略机器人自己的消息');
        return res.json({});
    }
    if (message.startsWith('[QQ]')) {
        console.log('[Bridge] 忽略已标记的 QQ 消息');
        return res.json({});
    }

    // 转发到 QQ 群
    try {
        await axios.post(`${NAPCAT_API}/send_group_msg`, {
            group_id: QQ_GROUP_ID,
            message: `[Minecraft] ${username}: ${message}`
        });
        console.log(`[Bridge] 已转发到 QQ 群: ${message}`);
    } catch (err) {
        console.error('[Bridge] 转发到 QQ 群失败:', err.message);
        if (err.response) {
            console.error('响应状态:', err.response.status, '数据:', err.response.data);
        }
    }

    res.json({});
});

// 接收 NapCat 上报的 QQ 群消息（QQ → MC）
app.post('/qq-webhook', (req, res) => {
    const data = req.body;
    console.log('[Bridge] 收到 webhook 请求');

    // 只处理群消息
    if (data.post_type === 'message' && data.message_type === 'group' && Number(data.group_id) === QQ_GROUP_ID) {
        // 过滤机器人自己的消息
        if (data.user_id == BOT_QQ) {
            console.log('[Bridge] 忽略机器人自己发送的消息');
            return res.json({});
        }

        // 提取文本消息（只从 message 数组中提取 text 类型）
        let msgText = '';
        if (data.message && Array.isArray(data.message)) {
            for (const seg of data.message) {
                if (seg.type === 'text') {
                    msgText += seg.data.text;
                }
            }
        }

        // 如果没有任何文本内容，忽略该消息（纯图片/表情）
        if (!msgText.trim()) {
            console.log('[Bridge] 消息无文本内容，忽略');
            return res.json({});
        }

        const senderName = data.sender?.nickname || `QQ-${data.user_id}`;
        const fullMsg = `[QQ] ${senderName}: ${msgText}`;
        console.log(`[Bridge] 转发 QQ 消息: ${fullMsg}`);
        sendToMinecraft(fullMsg);
    } else {
        console.log('[Bridge] 消息不符合群消息条件');
    }
    res.json({});
});

// 启动桥接服务
app.listen(BRIDGE_PORT, '0.0.0.0', () => {
    console.log(`[Bridge] QQ-Minecraft 桥接服务运行在 http://0.0.0.0:${BRIDGE_PORT}`);
    console.log(`[Bridge] 请确保 NapCat 的 HTTP 上报地址设为 http://127.0.0.1:${BRIDGE_PORT}/qq-webhook`);
});