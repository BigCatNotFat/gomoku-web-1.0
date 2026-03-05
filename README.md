# Gomoku Web 1.0

一个支持“同一链接多人进入”的网页五子棋：
- 第 1 个进入房间的人 = 1 号玩家（黑棋）
- 第 2 个进入房间的人 = 2 号玩家（白棋）
- 第 3 个及以后进入的人 = 观战

## 1.0 功能

- 15x15 棋盘
- 实时同步落子（Socket.IO）
- 自动判定五连胜
- 玩家离线后席位释放，新加入者可补位
- 支持玩家重开（观战者不可重开）
- 房间化链接（`/room/<roomId>`）

## 本地运行

```bash
npm install
npm run dev
# 或 npm start
```

默认地址：`http://localhost:3000/room/lobby`

## 技术栈

- Node.js + Express
- Socket.IO
- 原生 HTML/CSS/JS（无前端框架）

## 推荐发布流程（标准团队流程）

### Git 分支策略

- `main`：生产分支
- `develop`：集成分支（可选）
- `feature/v1.0-gomoku-room`：功能开发分支

### 典型步骤

1. 初始化仓库并首发
   ```bash
   git init
   git add .
   git commit -m "feat: gomoku web v1.0"
   ```
2. 推送到 GitHub
   ```bash
   git remote add origin <your-repo-url>
   git branch -M main
   git push -u origin main
   ```
3. 若走 PR 流程
   - 从 `main` 切 `feature/*`
   - 功能完成后发 PR 到 `main`
   - 代码评审通过后合并
4. 打版本标签
   ```bash
   git tag -a v1.0.0 -m "release: v1.0.0"
   git push origin v1.0.0
   ```

## 部署建议

可直接部署到 Render / Railway / Fly.io / 腾讯云轻量服务器等。

部署后把访问链接分享给玩家即可：同一房间链接可多人进入，自动分配 1 号 / 2 号 / 观战身份。
