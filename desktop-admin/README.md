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

生成 Windows 可执行文件：

```bash
npm run dist
```

打包结果在 `desktop-admin/dist/` 中：

- `居民反馈管理.exe`：免安装版，双击运行
- `居民反馈管理 Setup ...exe`：安装版
