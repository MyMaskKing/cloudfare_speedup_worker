# Cloudflare Worker 子域名动态反向代理

这是一个用于Cloudflare Workers的子域名动态反向代理脚本，可以帮助你通过Cloudflare的CDN网络将访问从`*.proxy.cn`自动代理到对应的`*.mydomain.com`网站。

## 功能特点

- 基于子域名的动态反向代理
- 固定域名格式：`*.proxy.cn` → `*.mydomain.com`
- 自动替换响应内容中的域名引用
- 处理各种内容类型（HTML、CSS、JavaScript、JSON等）
- 错误处理与日志记录

## 代理流程演示

- 用户访问 `blog.proxy.cn`
- Worker自动代理到 `blog.mydomain.com`
- 响应内容中的 `blog.mydomain.com` 会被替换为 `blog.proxy.cn`

域名的结构说明：
- `proxy.cn` 是固定的代理域名
- `mydomain.com` 是固定的目标域名
- 子域名前缀（如`blog`）是动态的，同样的前缀会应用到目标域名

## 配置说明

所有配置参数都集中在代码顶部的`CONFIG`对象中，方便直接修改：

```javascript
const CONFIG = {
  // 代理域名（访问的域名，如 *.proxy.cn）
  PROXY_DOMAIN: 'proxy.cn',
  
  // 目标域名（实际服务器的域名，如 *.mydomain.com）
  TARGET_DOMAIN: 'mydomain.com',
  
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
    INVALID_DOMAIN: '不支持的域名格式，请使用正确的代理域名',
    INVALID_SUBDOMAIN: '无效的子域名',
    PROXY_FAILED: '代理请求失败: '
  }
};
```

### 修改配置示例

1. 更改代理域名和目标域名：
```javascript
PROXY_DOMAIN: 'myproxy.com',
TARGET_DOMAIN: 'original-site.com',
```

2. 使用HTTP而非HTTPS访问目标站点：
```javascript
USE_HTTPS: false,
```

3. 添加或移除需要内容替换的MIME类型：
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
6. 按需修改配置参数
7. 点击"部署"来发布你的Worker

### 2. 配置Workers路由

1. 在Cloudflare的Workers部分，找到你的Worker
2. 点击"添加路由"
3. 添加路由规则：`*.你的代理域名/*`（例如：`*.proxy.cn/*`）
4. 选择你部署的Worker

### 3. 设置DNS

1. 确保你的代理域名已添加到你的Cloudflare账户中
2. 在DNS设置中，为通配符添加一条记录：
   - 类型: `CNAME`
   - 名称: `*`（表示通配符）
   - 目标: 你的Worker的域名（例如：`yourworker.yourusername.workers.dev`）
   - 代理状态: 已代理（橙色云图标）

### 4. 测试代理

设置完成后，通过浏览器访问任意子域名如`blog.你的代理域名`，它会自动代理到相应的`blog.你的目标域名`。

## 自定义与配置

### 修改域名

如果你想要使用不同的代理域名或目标域名，需要修改代码中的两个地方：

1. 检查域名的部分：
```javascript
if (!hostname.endsWith('proxy.cn')) {
  return new Response('不支持的域名格式，请使用 *.proxy.cn', { status: 400 });
}
```

2. 构建目标URL的部分：
```javascript
const targetUrl = `https://${subdomain}.mydomain.com${pathname}${url.search}`;
```

3. 内容替换的部分：
```javascript
const sourcePattern = new RegExp(`${subdomain}\\.mydomain\\.com`, 'g');
text = text.replace(sourcePattern, `${subdomain}.proxy.cn`);
```

### 添加安全头

你可以为代理的响应添加安全相关的HTTP头：

```javascript
// 在返回响应前，添加安全头
responseHeaders.set('Strict-Transport-Security', 'max-age=31536000');
responseHeaders.set('X-Content-Type-Options', 'nosniff');
responseHeaders.set('X-Frame-Options', 'DENY');
```

## 常见问题解答

1. **问题**: 子域名代理后网站中的某些链接不能正常工作
   **解答**: 可能是因为网站内容中包含非标准格式的域名引用，可能需要添加更多替换规则

2. **问题**: 代理后部分资源加载失败
   **解答**: 检查网站是否使用了非标准端口或HTTPS/HTTP混合内容，可以调整`USE_HTTPS`参数

3. **问题**: 网站样式或脚本加载不正确
   **解答**: 确认`CONTENT_TYPES_TO_REPLACE`包含了所有需要替换内容的MIME类型

## 性能注意事项

- Cloudflare Workers有每日请求限制，请关注你的使用量
- 大型网站的内容替换可能会消耗更多CPU时间
- 考虑使用Cloudflare的缓存功能来提高性能

## 许可

MIT License 