# Cloudflare Worker 子域名动态反向代理

一个用于Cloudflare Workers的反向代理工具，可以代理任意子域名到指定的目标服务器。

## 简明功能

- 自动代理子域名请求到指定目标服务器
- 通过环境变量轻松配置映射关系
- 支持 WebSocket 代理与可选的 CORS 跨域
- 加速模式：特定子域名直接转发到第三方 CDN 加速域名（省掉中转域名）
- 旁路模式：特定子域名纯透传，不改写任何请求头

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

3. **加速与旁路（可选）**
   - `ACCEL_DOMAIN` = 第三方 CDN 加速接入域名（如: `xxx.cdn-provider.com`）
   - `ACCEL_SUBDOMAINS` = 走加速的子域名列表，逗号分隔（如: `cdn,static`）
   - `BYPASS_SUBDOMAINS` = 纯透传的子域名列表，逗号分隔（如: `raw,direct`）

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

## 加速与旁路模式

三个可选变量决定子域名的处理方式，**优先级：旁路 > 加速 > 普通映射**：

- **加速模式**：命中 `ACCEL_SUBDOMAINS` 的子域名会直接转发到 `ACCEL_DOMAIN`，并把 `Host`/`Origin`/`Referer` 改写为加速域名。适合「一个入口域名直连第三方 CDN，无需再单独购买中转域名」的场景。
  - 例：`ACCEL_DOMAIN=xxx.cdn.com`、`ACCEL_SUBDOMAINS=cdn` → `cdn.yourdomain.com/*` 全部转发到 `xxx.cdn.com`
- **旁路模式**：命中 `BYPASS_SUBDOMAINS` 的子域名**纯透传**，不改写任何请求头、不处理重定向/Cookie/CORS，原样转发。用于需要保持原始请求头的场景。
- 三个变量均留空时，行为与普通子域名映射完全一致。

## 故障排除

- **子域名映射不生效**: 确保环境变量名与子域名完全匹配(区分大小写)
- **加速/旁路不生效**: 确认子域名已加入对应列表，且 `ACCEL_DOMAIN` 已设置；注意同一子域名若同时出现在两个列表，旁路优先