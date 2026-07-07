# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 常用命令

### 使用 Wrangler 部署
```bash
# 登录 Cloudflare
wrangler login

# 本地开发（实时预览）
wrangler dev

# 部署到 Cloudflare Workers
wrangler deploy
```

### 类型检查
此项目是纯 JavaScript，无需编译/类型检查。

## 架构说明

### 项目用途
Cloudflare Workers 子域名动态反向代理 —— 将 `*.your-domain.com` 动态代理到不同的目标服务器，通过环境变量配置映射关系。

### Worker 运行模式（关键约束）
`worker.js` 使用 **Service Worker 格式**（`addEventListener('fetch')`），而非 Module Worker（`export default`）。这带来一个重要影响：**环境变量通过全局作用域访问**，而不是 handler 的 `env` 参数：
- `TARGET_DOMAIN` / `USE_HTTPS` / `ENABLE_CORS` 通过 `typeof VAR !== 'undefined'` 读取全局
- 子域名映射通过 `self[subdomain]` 动态查找（即环境变量名 = 子域名）

因此 `getConfig()` 每次请求都重新读取全局变量以拿到最新值。修改此文件时不要改成 `env` 参数写法，否则子域名映射逻辑会失效。

### 请求处理流程
1. **解析子域名**：从请求 hostname 提取第一个分段作为子域名
2. **查找目标映射**：`getTargetForSubdomain` 从全局 `self[subdomain]` 查找映射，未找到则回退到 `{subdomain}.{TARGET_DOMAIN}` 默认规则
3. **修正请求头**：修正 Origin、Host、Referer 头为目标域名，保证目标服务器正确处理
4. **CORS 预检**（启用时）：`OPTIONS` 请求直接返回 204，回显请求方 `Origin` 及请求的方法/头
5. **特殊协议处理**：
   - WebSocket：通过 WebSocketPair 建立双向连接，转发所有消息和关闭/错误事件；升级响应（101）也会附加 CORS 头
   - 普通 HTTP：以 `redirect: 'manual'` 通过 fetch 转发到目标
6. **重定向处理**：如果响应 Location 头指向目标域名，替换为当前代理域名，保持用户始终看到自己的域名
7. **多 Set-Cookie 处理**：Cloudflare Workers 会合并多个 Set-Cookie 头，代码用 `headers.getAll('set-cookie')` 拆分后逐个 `append`，避免丢失 cookie
8. **CORS 响应头**（启用时）：`addCorsHeaders` 统一镜像请求方 `Origin`（而非 `*`）并附带 `Vary: Origin`；有 Origin 时同时返回 `Access-Control-Allow-Credentials: true`

### 文件说明
| 文件 | 说明 | 状态 |
|------|------|------|
| `worker.js` | 主版本，包含 WebSocket 代理支持，推荐用于生产 | **当前活跃开发** |
| `worker_only_fetch.js` | 极简纯 fetch 转发版本，不做内容替换 | 备用选项 |
| `worker_custom_forward.js` | 旧版本，包含内容替换和 OAuth 提示页面 | **已废弃**，功能在直接转发模式下不再需要 |
| `wrangler.toml` | Wrangler 配置文件，包含本地环境变量示例 | 配置 |

### 配置方式
通过环境变量配置：
- `TARGET_DOMAIN`：默认目标域名（当子域名没有 explicit 映射时使用）
- `USE_HTTPS`：是否使用 HTTPS 访问目标 (`true`/`false`，默认 `true`)
- `ENABLE_CORS`：是否启用 CORS 跨域支持 (`true`/`false`，默认 `false`)
- `{subdomain}`：子域名作为变量名，值为完整目标地址（例如 `blog` → `blog.example.com`）

> 布尔型变量（`USE_HTTPS`/`ENABLE_CORS`）统一用 `VAR === "false" ? false : Boolean(VAR)` 解析，只有字符串 `"false"` 才为假。

> ⚠️ `wrangler deploy` 会用 `wrangler.toml` 的 `[vars]` 覆盖 Cloudflare 面板上的明文变量。要么把值写进 `wrangler.toml`，要么只用面板管理并通过面板部署，二者不要混用。

> ⚠️ **关于「优选 IP 加速」**：优选域名（如 `xxx.182682.xyz`）只能在 **DNS/CNAME 层**使用（把业务子域名 CNAME 到优选域名、灰云 DNS only），让客户端解析到更快的 Cloudflare 节点 IP。**不能**在本 Worker 里用 `fetch` 转发到优选域名——Worker 的 `fetch` 无法「连指定 IP 但发真实 Host」，且 Worker 本就运行在 Cloudflare 内部，转发到优选域名只会命中不存在的站点并返回 Error 1001。

### 核心设计原则
- **直接转发优先**：保持客户端与后端的完整交互，不干扰 OAuth/WebSocket/SSE 等特殊协议
- **环境变量配置**：无需改代码，通过 Cloudflare 控制台配置子域名映射
- **最小处理**：只修改必须修正的请求头和重定向，尽可能透传原始数据

### 部署前提（决定子域名解析逻辑）
代理依赖通配符路由生效，缺一不可：
- **路由规则**：`*.你的域名/*` 绑定到本 Worker
- **DNS**：通配符 CNAME 记录（名称 `*`，代理状态开启/橙色云）

正因为所有 `*.你的域名` 都进入同一个 Worker，代码才需要从 `hostname` 拆分子域名来决定转发目标。
