# 居民反馈接收后端

这个服务负责接收网页提交的居民反馈，并提供一个简单的管理页面。

## 本地运行

```bash
cd server
$env:ADMIN_KEY="自己设置一个管理密钥"
$env:ALLOWED_ORIGIN="https://fws20061014-hue.github.io"
npm start
```

本地地址：

- 接收反馈：`POST http://localhost:3000/api/feedback`
- 管理页面：`http://localhost:3000/admin`
- 健康检查：`GET http://localhost:3000/health`

## 需要部署到云端时

把 `server` 文件夹部署到支持 Node.js 的云平台或服务器，并设置环境变量：

- `PORT`：平台通常自动提供
- `ADMIN_KEY`：管理员查看反馈和修改状态的密钥
- `ALLOWED_ORIGIN`：前端网页地址，例如 `https://fws20061014-hue.github.io`

部署完成后，把前端 `config.js` 里的 `feedbackApiBase` 改成云端后端地址。
