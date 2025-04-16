# Cloudflare Worker 子域名动态反向代理

一个用于Cloudflare Workers的反向代理工具，可以代理任意子域名到指定的目标服务器。

## 简明功能

- 自动代理子域名请求到指定目标服务器
- 通过环境变量轻松配置映射关系
- 自动替换响应内容中的域名引用

## 快速配置

### 环境变量设置

在Cloudflare Workers的"Settings">"Variables"中添加以下环境变量：

1. **基本配置**
   - `TARGET_DOMAIN` = 默认目标域名（如: `example.com`）
   - `USE_HTTPS` = 是否使用HTTPS协议（`true`/`false`）

2. **子域名映射**
   - 直接使用子域名作为变量名
   - 变量值为完整的目标服务器地址

例如:
- 变量名: `blog` → 变量值: `aaa.blog.com`
- 变量名: `api` → 变量值: `api-server.example.org`

### 部署步骤

1. **创建Worker**
   - 登录Cloudflare账户 → "Workers & Pages"
   - 创建应用程序 → 创建Worker
   - 复制`worker.js`内容到编辑器
   - 设置环境变量
   - 点击部署

2. **配置路由**
   - 添加路由规则: `*.你的域名/*`
   - 选择部署的Worker

3. **设置DNS**
   - 添加通配符CNAME记录:
     - 名称: `*`
     - 目标: 你的Worker域名
     - 代理状态: 已代理(橙色云图标)

## 使用实例

假设设置了以下环境变量:
- `blog` = `aaa.blog.com`
- `TARGET_DOMAIN` = `example.com`

访问效果:
- `blog.yourdomain.com` → 代理到 `aaa.blog.com`
- `www.yourdomain.com` → 代理到 `www.example.com`
- `api.yourdomain.com` → 代理到 `api.example.com`

## 故障排除

- **子域名映射不生效**: 确保环境变量名与子域名完全匹配(区分大小写)
- **内容替换问题**: 检查内容类型是否包含在配置的替换列表中 