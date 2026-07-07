# Cloudflare Worker 子域名动态反向代理

一个用于Cloudflare Workers的反向代理工具，可以代理任意子域名到指定的目标服务器。

## 简明功能

- 自动代理子域名请求到指定目标服务器
- 通过环境变量轻松配置映射关系
- 支持 WebSocket 代理与可选的 CORS 跨域
- 加速模式：特定子域名直接转发到第三方 CDN 加速域名（省掉中转域名）

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

3. **加速模式（可选）**
   - `ACCEL_DOMAIN` = 第三方 CDN 加速接入域名（如: `xxx.cdn-provider.com`）
   - `ACCEL_SUBDOMAINS` = 走加速的子域名列表，逗号分隔（如: `cdn,static`）
   - `ACCEL_USE_HTTPS` = 加速域名是否用 HTTPS（`true`/`false`，默认 `true`；独立于 `USE_HTTPS`，仅对加速请求生效）

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

## 加速模式

加速模式让特定子域名直接转发到第三方 CDN 加速域名，无需再单独购买、维护一个中转域名（域名B）：

- 命中 `ACCEL_SUBDOMAINS` 的子域名会直接转发到 `ACCEL_DOMAIN`，并把 `Host`/`Origin`/`Referer` 改写为加速域名
- 例：`ACCEL_DOMAIN=xxx.cdn.com`、`ACCEL_SUBDOMAINS=cdn` → `cdn.yourdomain.com/*` 全部转发到 `xxx.cdn.com`
- `ACCEL_DOMAIN` 留空或子域名不在 `ACCEL_SUBDOMAINS` 时，走普通子域名映射逻辑
- 加速请求的协议由 `ACCEL_USE_HTTPS` 单独控制（默认 `true`），不受全局 `USE_HTTPS` 影响

**优先级**：加速模式 > 普通子域名映射 > 默认规则（`{子域名}.{TARGET_DOMAIN}`）

> ⚠️ 第三方 CDN 通常靠 `Host` 头识别站点。若加速不生效返回错误页，检查 CDN 后台要求的访问 Host 是否就是 `ACCEL_DOMAIN`；如果 CDN 要求保留业务域名 Host，则不适用本模式。
> ⚠️ 若加速域名直连报 `526 Invalid SSL certificate`，说明该域名没有为「直接 HTTPS 访问」提供合法证书。可尝试将 `ACCEL_USE_HTTPS` 设为 `false` 走 HTTP；若加速域名强制跳转 HTTPS 或靠 CNAME 自定义域名识别站点，则改协议无效，需保留中转域名（可用主域名下的一条 CNAME 子记录，无需另购域名）。

## 让特定子域名不走本 Worker（走 Cloudflare Pages 等）

通配符路由 `*.你的域名/*` 会拦截**所有**子域名。如果某个子域名（例如 `blog`）需要交给 Cloudflare Pages / 其他服务，而**不进入本 Worker**，不能用代码解决（Worker 无法把请求退回给 Cloudflare，且转发回自身会造成死循环）——必须在**路由层排除**。

Cloudflare 路由规则「越精确越优先」，新增一条更精确、且**不绑定任何 Worker** 的路由即可排除：

```
blog.你的域名/*   ->  <无 Worker>       ← 更精确，请求走正常解析（Pages）
*.你的域名/*      ->  speedup（本 Worker） ← 通配符，兜底其余子域名
```

**操作步骤（纯面板，不改代码）：**

1. Cloudflare Dashboard → 进入**域名所在的 Zone**（域名管理页，不是 Worker 页面）
2. 左侧 **Workers Routes / Workers 路由**
3. **Add route / 添加路由**：
   - Route（路由）：`blog.你的域名/*`
   - Worker：选 **None / 无**（关键：不绑定任何 Worker）
4. 保存

保存后 `blog.你的域名` 跳过本 Worker，直接由 Cloudflare 解析到 Pages 项目；其余子域名仍照常走 Worker。

> 新版面板入口可能在 Worker 的 **Settings → Domains & Routes**，但这条「不绑 Worker」的排除路由必须在 **Zone 的 Workers Routes** 里添加。

## 故障排除

- **子域名映射不生效**: 确保环境变量名与子域名完全匹配(区分大小写)
- **加速不生效**: 确认子域名已加入 `ACCEL_SUBDOMAINS`，且 `ACCEL_DOMAIN` 已设置；检查 CDN 要求的访问 Host 是否为 `ACCEL_DOMAIN`
- **面板改的变量部署后被覆盖**: `wrangler deploy` 会用 `wrangler.toml` 的 `[vars]` 覆盖面板明文变量。要么把值写进 `wrangler.toml`，要么只用面板管理并通过面板部署，二者不要混用