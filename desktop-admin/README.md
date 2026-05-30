# 居民反馈 Windows 桌面管理软件

这是一个基于 Electron 的 Windows 桌面管理端，用于连接环境监测服务器并管理居民反馈。

## 功能

- 连接反馈后端接口
- 读取居民反馈列表
- 按状态、紧急程度、关键词筛选
- 更新处理状态
- 统计全部反馈、待处理、紧急、需要回访数量
- 导出 CSV 和 JSON

## 运行

```bash
cd desktop-admin
npm install
npm start
```

默认服务器地址：

```text
http://122.152.220.132
```

管理员密钥需要填写服务器部署时设置的 `ADMIN_KEY`。

## 后续打包

当前版本先用于本机运行和演示。后续如果需要生成 `.exe` 安装包，可以继续加入 `electron-builder`。
