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

### 请求处理流程
1. **解析子域名**：从请求 hostname 提取第一个分段作为子域名
2. **查找目标映射**：从环境变量查找子域名 → 目标域名映射，如果未找到则使用 `{subdomain}.{TARGET_DOMAIN}` 默认规则
3. **修正请求头**：修正 Origin、Host、Referer 头为目标域名，保证目标服务器正确处理
4. **特殊协议处理**：
   - WebSocket：通过 WebSocketPair 建立双向连接，转发所有消息和关闭/错误事件
   - 普通 HTTP：直接通过 fetch 转发到目标
5. **重定向处理**：如果响应 Location 头指向目标域名，替换为当前代理域名，保持用户始终看到自己的域名

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

### 核心设计原则
- **直接转发优先**：保持客户端与后端的完整交互，不干扰 OAuth/WebSocket/SSE 等特殊协议
- **环境变量配置**：无需改代码，通过 Cloudflare 控制台配置子域名映射
- **最小处理**：只修改必须修正的请求头和重定向，尽可能透传原始数据
