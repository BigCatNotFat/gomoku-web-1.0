# Gomoku Web 1.3.0

一个支持“同一链接多人进入”的网页五子棋：
- 第 1 个进入房间的人 = 1 号玩家（黑棋）
- 第 2 个进入房间的人 = 2 号玩家（白棋）
- 第 3 个及以后进入的人 = 观战

## 1.3 功能

- 15x15 棋盘
- 实时同步落子（Socket.IO）
- 自动判定五连胜
- 玩家离线后席位释放，新加入者可补位
- 房间化链接（`/room/<roomId>`）
- 回合计时（当前回合实时计时）
- 胜负结果弹层 + 再来一局 UI
- 房间语音（麦克风按钮，基于 WebRTC）
- **准备开局机制：1号和2号都点击准备后，才会自动开始对局**

## 语音功能注意

- 浏览器对麦克风有安全限制：
  - ✅ `https://` 可用
  - ✅ `http://localhost` 可用
  - ❌ 公网 IP 的 `http://` 默认不可用
- 因此生产环境务必使用 HTTPS（域名证书或隧道 HTTPS）。

## 本地运行

```bash
npm install
npm run dev
# 或 npm start
```

默认地址：`http://localhost:3000/room/lobby`

## 技术栈

- Node.js + Express
- Socket.IO（游戏状态 + 信令）
- WebRTC（语音）
- 原生 HTML/CSS/JS（无前端框架）
