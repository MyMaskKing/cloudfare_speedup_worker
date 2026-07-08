# Cloudflare Worker 子域名动态反向代理

一个用于Cloudflare Workers的反向代理工具，可以代理任意子域名到指定的目标服务器。

## 简明功能

- 自动代理子域名请求到指定目标服务器
- 通过环境变量轻松配置映射关系
- 支持 WebSocket 代理与可选的 CORS 跨域

## 快速配置

### 环境变量设置

在Cloudflare Workers的"Settings">"Variables"中添加以下环境变量：

1. **基本配置**
   - `TARGET_DOMAIN` = 默认目标域名（如: `example.com`）
   - `USE_HTTPS` = 是否使用HTTPS协议（`true`/`false`）

2. **子域名映射（两种写法，可共存）**

   **① 集中映射表 `SUBDOMAIN_MAP`（推荐，支持一键导入导出）**
   - 值为 JSON 字符串：`{"子域名":"目标地址", ...}`
   - 例：`{"blog":"www.myblog.com","api":"api-server.example.org"}`
   - 新增/删除站点只改这一个变量；整份配置就是这段 JSON，**复制粘贴即完成导入导出**

   **② 单变量写法（旧，仍兼容）**
   - 直接用子域名作为变量名，变量值为完整目标地址
   - 例：变量名 `blog` → 值 `aaa.blog.com`

   > 查找优先级：`SUBDOMAIN_MAP` > 单变量 > 默认规则 `{子域名}.{TARGET_DOMAIN}`

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

## 优选 IP 加速（在 DNS 层做，不经过本 Worker）

如果你想让某个子域名走「优选 IP」提速，请注意：**优选域名（如 `xxx.182682.xyz`）不是一个可代理的站点，而是一批更快的 Cloudflare 节点 IP。** 它只能在 **DNS/CNAME 层**使用，不能在本 Worker 里 `fetch` 转发（Worker 无法「连指定 IP 但发真实 Host」，且本身已运行在 Cloudflare 内部，转发到优选域名只会命中不存在的站点并返回 **Error 1001**）。

**正确做法（前提：该子域名的真实站点本来就托管在 Cloudflare 上）：**

1. Cloudflare Dashboard → 域名的 **DNS** 设置
2. 找到要加速的子域名记录，改为 **CNAME**，目标填优选域名（如 `cloudflare.182682.xyz`）
3. 代理状态设为 **DNS only（灰色云）** —— 优选域名已在 Cloudflare 网络，再套橙云会冲突

这样客户端解析该子域名 → 拿到优选 IP → 发出的 Host 仍是你的业务域名 → Cloudflare 正确路由。全程不经过本 Worker。

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
- **面板改的变量部署后被覆盖**: `wrangler deploy` 会用 `wrangler.toml` 的 `[vars]` 覆盖面板明文变量。要么把值写进 `wrangler.toml`，要么只用面板管理并通过面板部署，二者不要混用