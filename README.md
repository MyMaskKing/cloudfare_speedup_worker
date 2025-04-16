# Cloudflare Worker 子域名动态反向代理

这是一个用于Cloudflare Workers的子域名动态反向代理脚本，可以帮助你通过Cloudflare的CDN网络将请求自动代理到目标域名的对应子域名。

## 功能特点

- 自动从请求中获取代理域名，无需硬编码
- 支持通过环境变量配置目标域名
- 基于子域名的动态反向代理
- 自动替换响应内容中的域名引用
- 处理各种内容类型（HTML、CSS、JavaScript、JSON等）
- 错误处理与日志记录

## 代理流程演示

- 用户访问 `blog.任意域名`
- Worker自动代理到 `blog.配置的目标域名`
- 响应内容中的 `blog.配置的目标域名` 会被替换为 `blog.任意域名`

域名的结构说明：
- 代理域名会自动从请求中获取，无需配置
- 目标域名可通过环境变量设置，也可使用代码中的默认值
- 子域名前缀（如`blog`）是动态的，同样的前缀会应用到目标域名

## 配置说明

### 环境变量配置（推荐）

在Cloudflare Workers的设置中，你可以添加以下环境变量：

- `TARGET_DOMAIN` - 目标域名（如：`mydomain.com`）
- `USE_HTTPS` - 是否使用HTTPS协议（可设为`true`或`false`）

配置环境变量的优点是可以在不修改代码的情况下更改配置，也方便多环境部署。

### 代码配置（备选）

如果未设置环境变量，代码会使用`DEFAULT_CONFIG`对象中的默认值：

```javascript
const DEFAULT_CONFIG = {
  // 目标域名（实际服务器的域名，如 *.mydomain.com）- 如有环境变量会被覆盖
  TARGET_DOMAIN: 'mymaskking.ggff.net',
  
  // 是否使用HTTPS协议访问目标域名
  USE_HTTPS: true,
  
  // 需要进行内容替换的内容类型
  CONTENT_TYPES_TO_REPLACE: [
    'text/html',
    'text/css',
    'application/javascript',
    'application/json'
  ],
  
  // 错误消息
  ERROR_MESSAGES: {
    INVALID_SUBDOMAIN: '无效的子域名',
    PROXY_FAILED: '代理请求失败: '
  }
};
```

### 修改配置示例

1. 使用环境变量设置目标域名（推荐）：
   - 在Cloudflare Workers设置中添加`TARGET_DOMAIN`环境变量
   - 值设为`original-site.com`

2. 修改默认配置中的目标域名（如果不使用环境变量）：
   ```javascript
   TARGET_DOMAIN: 'original-site.com',
   ```

3. 使用HTTP而非HTTPS访问目标站点：
   - 添加环境变量`USE_HTTPS`并设置为`false`
   - 或在默认配置中修改：
   ```javascript
   USE_HTTPS: false,
   ```

4. 添加或移除需要内容替换的MIME类型：
   ```javascript
   CONTENT_TYPES_TO_REPLACE: [
     'text/html',
     'text/css',
     'application/javascript',
     'application/xml',  // 添加XML替换
   ],
   ```

## 使用方法

### 1. 创建Cloudflare Worker

1. 登录到你的Cloudflare账户
2. 进入"Workers & Pages"部分
3. 点击"创建应用程序"
4. 选择"创建Worker"
5. 将`worker.js`文件的内容复制到编辑器中
6. 在"Settings">"Variables"中添加环境变量（可选）
7. 点击"部署"来发布你的Worker

### 2. 配置Workers路由

1. 在Cloudflare的Workers部分，找到你的Worker
2. 点击"添加路由"
3. 添加路由规则：`*.你的域名/*`（可以添加多个不同的域名）
4. 选择你部署的Worker

### 3. 设置DNS

1. 确保你要使用的域名已添加到你的Cloudflare账户中
2. 在DNS设置中，为通配符添加一条记录：
   - 类型: `CNAME`
   - 名称: `*`（表示通配符）
   - 目标: 你的Worker的域名（例如：`yourworker.yourusername.workers.dev`）
   - 代理状态: 已代理（橙色云图标）

### 4. 测试代理

设置完成后，通过浏览器访问任意子域名如`blog.你的域名`，它会自动代理到相应的`blog.配置的目标域名`。

## 多环境部署

使用环境变量配置使得多环境部署变得简单：

1. 开发环境：
   - 环境变量：`TARGET_DOMAIN = dev.example.com`

2. 测试环境：
   - 环境变量：`TARGET_DOMAIN = test.example.com`

3. 生产环境：
   - 环境变量：`TARGET_DOMAIN = www.example.com`

## 灵活性说明

这个实现的优点是：
- 通过环境变量配置，无需修改代码即可更改目标域名
- 你可以在不修改Worker代码的情况下使用多个不同的域名作为代理入口
- 只需要在Cloudflare的路由配置中添加新的域名即可
- 所有这些域名都会自动代理到同一个目标域名，保持子域名结构

## 常见问题解答

1. **问题**: 如何快速切换目标域名？
   **解答**: 在Cloudflare Workers的环境变量设置中修改`TARGET_DOMAIN`值即可

2. **问题**: 子域名代理后网站中的某些链接不能正常工作
   **解答**: 可能是因为网站内容中包含非标准格式的域名引用，可能需要添加更多替换规则

3. **问题**: 代理后部分资源加载失败
   **解答**: 检查网站是否使用了非标准端口或HTTPS/HTTP混合内容，可以通过环境变量调整`USE_HTTPS`参数

4. **问题**: 网站样式或脚本加载不正确
   **解答**: 确认`CONTENT_TYPES_TO_REPLACE`包含了所有需要替换内容的MIME类型

## 性能注意事项

- Cloudflare Workers有每日请求限制，请关注你的使用量
- 大型网站的内容替换可能会消耗更多CPU时间
- 考虑使用Cloudflare的缓存功能来提高性能

## 许可

MIT License 