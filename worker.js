// Cloudflare Workers - 子域名动态反向代理

// 默认配置参数（可修改）
const DEFAULT_CONFIG = {
  // 默认目标域名（实际服务器的域名，如 *.mydomain.com）- 仅在找不到子域名映射时使用
  TARGET_DOMAIN: 'your.target.domain',
  
  // 是否使用HTTPS协议访问目标域名
  USE_HTTPS: true,

  // 错误消息
  ERROR_MESSAGES: {
    INVALID_SUBDOMAIN: '无效的子域名',
    PROXY_FAILED: '代理请求失败: '
  }
};

// 合并环境变量和默认配置
// 注意：此处使用函数是为了确保在每次请求时都能获取最新的环境变量
function getConfig() {
  const config = { ...DEFAULT_CONFIG };
  
  // 如果环境变量中有设置目标域名，则使用环境变量的值
  if (typeof TARGET_DOMAIN !== 'undefined') {
    config.TARGET_DOMAIN = TARGET_DOMAIN;
  }
  
  return config;
}

// 监听所有请求
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

/**
 * 获取子域名映射的目标域名
 * @param {string} subdomain - 子域名前缀
 * @returns {string|null} - 目标域名，如果不存在则返回null
 */
function getTargetForSubdomain(subdomain) {
  // 直接从环境变量中查找对应的子域名映射
  // 例如: blog子域名可以通过名为"blog"的环境变量获取目标域名
  return typeof self[subdomain] !== 'undefined' ? self[subdomain] : null;
}

/**
 * 处理请求的主函数
 * @param {Request} request - 原始请求
 * @returns {Promise<Response>} - 代理后的响应
 */
async function handleRequest(request) {
  // 获取当前配置（结合环境变量）
  const CONFIG = getConfig();
  const url = new URL(request.url);
  const hostname = url.hostname;
  const pathname = url.pathname;
  // 提取子域名前缀和代理主域名
  const hostnameParts = hostname.split('.');
  const subdomain = hostnameParts[0];
  // 确保有有效的子域名
  if (!subdomain) {
    return new Response(CONFIG.ERROR_MESSAGES.INVALID_SUBDOMAIN, { status: 400 });
  }
  // 尝试获取此子域名的目标域名映射
  let targetDomain = getTargetForSubdomain(subdomain);
  // 如果没有找到映射，则使用默认目标域名
  if (!targetDomain) {
    targetDomain = `${subdomain}.${CONFIG.TARGET_DOMAIN}`;
  }
  // 构建目标URL
  const protocol = CONFIG.USE_HTTPS ? 'https' : 'http';
  const targetUrl = `${protocol}://${targetDomain}${pathname}${url.search}`;

  // 修正 Origin 头为目标域名和协议
  const requestHeaders = new Headers(request.headers);
  if (requestHeaders.has('Origin')) {
    try {
      const originUrl = new URL(requestHeaders.get('Origin'));
      originUrl.protocol = protocol + ':';
      originUrl.host = targetDomain;
      // 标准 Origin 格式：协议+双斜杠+主机，不带结尾斜杠
      requestHeaders.set('Origin', originUrl.protocol + '//' + originUrl.host);
    } catch {}
  }
  // 修正 Host 头为目标域名
  requestHeaders.set('Host', targetDomain);
  // 修正 Referer 头（如存在），协议和主机同步为目标域名
  if (requestHeaders.has('Referer')) {
    try {
      const refererUrl = new URL(requestHeaders.get('Referer'));
      refererUrl.protocol = protocol + ':';
      refererUrl.host = targetDomain;
      requestHeaders.set('Referer', refererUrl.toString());
    } catch {}
  }

  // === WebSocket 升级代理处理 - 优化部分 ===
  if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
    try {
      const { 0: client, 1: server } = new WebSocketPair();  
      // 使用 fetch 建立到上游服务器的 WebSocket 连接
      // 关键：将 server 端作为参数传递，Cloudflare Worker 将自动处理转发
      const upstreamResponse = await fetch(targetUrl, {
        method: request.method,
        headers: requestHeaders,
        body: request.body,
        webSocket: server
      });
  
      // 如果上游服务器没有返回 101，说明 WebSocket 握手失败
      if (upstreamResponse.status !== 101) {
        return upstreamResponse;
       }
  
      // 握手成功，返回一个带有 client 端的 101 响应
      // Worker 运行时会自动处理 client 和 server 之间的双向通信
      return new Response(null, {
        status: 101,
        webSocket: client
      });
    } catch (error) {
      console.error('WebSocket proxy error:', error);
      return new Response('WebSocket proxy failed', { status: 502 });
    }
  }
// === WebSocket 分支结束 ===

  // 直接转发，不做内容替换和自定义页面
  const modifiedRequest = new Request(targetUrl, {
    method: request.method,
    headers: requestHeaders,
    body: request.body,
    redirect: 'manual'
  });

  // 代理请求
  const response = await fetch(modifiedRequest);

  // 处理重定向Location头，保证用户始终看到自己的域名
  const responseHeaders = new Headers(response.headers);
  if (responseHeaders.has('Location')) {
    const location = responseHeaders.get('Location');
    try {
      const locationUrl = new URL(location, targetUrl);
      // 如果Location指向目标服务器域名，则替换为当前请求域名
      if (locationUrl.hostname === targetDomain) {
        locationUrl.hostname = hostname;
        responseHeaders.set('Location', locationUrl.toString());
      }
    } catch {
      // 如果Location不是合法URL，忽略
    }
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders
  });
}