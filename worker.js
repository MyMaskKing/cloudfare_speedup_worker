// Cloudflare Workers - 子域名动态反向代理

// 默认配置参数（可修改）
const DEFAULT_CONFIG = {
  // 默认目标域名（实际服务器的域名，如 *.mydomain.com）- 仅在找不到子域名映射时使用
  TARGET_DOMAIN: 'your.target.domain',
  
  // 是否使用HTTPS协议访问目标域名
  USE_HTTPS: true,

  // 是否启用CORS支持（跨域请求）
  ENABLE_CORS: false,

  // 加速接入域名（第三方CDN加速域名，替代原来的中转域名B）
  ACCEL_DOMAIN: '',

  // 走加速的子域名列表（逗号分隔），命中则直接转发到 ACCEL_DOMAIN
  ACCEL_SUBDOMAINS: [],

  // 加速域名是否使用HTTPS协议（独立于 USE_HTTPS，仅对加速请求生效）
  ACCEL_USE_HTTPS: true,

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

  // 如果环境变量中有设置是否使用HTTPS，则使用环境变量的值
  if (typeof USE_HTTPS !== 'undefined') {
    // 将字符串"false"转换为布尔值false
    config.USE_HTTPS = USE_HTTPS === "false" ? false : Boolean(USE_HTTPS);
  }

  // 如果环境变量中有设置是否启用CORS，则使用环境变量的值
  if (typeof ENABLE_CORS !== 'undefined') {
    config.ENABLE_CORS = ENABLE_CORS === "false" ? false : Boolean(ENABLE_CORS);
  }

  // 加速接入域名
  if (typeof ACCEL_DOMAIN !== 'undefined') {
    config.ACCEL_DOMAIN = ACCEL_DOMAIN;
  }

  // 走加速的子域名列表（逗号分隔字符串 → 去空白数组）
  if (typeof ACCEL_SUBDOMAINS !== 'undefined') {
    config.ACCEL_SUBDOMAINS = parseList(ACCEL_SUBDOMAINS);
  }

  // 加速域名是否使用HTTPS（独立开关）
  if (typeof ACCEL_USE_HTTPS !== 'undefined') {
    config.ACCEL_USE_HTTPS = ACCEL_USE_HTTPS === "false" ? false : Boolean(ACCEL_USE_HTTPS);
  }

  return config;
}

/**
 * 将逗号分隔的字符串解析为去除空白的非空数组
 * @param {string} str - 逗号分隔的字符串
 * @returns {string[]} - 解析后的数组
 */
function parseList(str) {
  if (typeof str !== 'string') return [];
  return str.split(',').map(s => s.trim()).filter(s => s.length > 0);
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
 * 添加CORS响应头到Headers对象
 * @param {Headers} headers - 目标Headers对象
 * @param {string|null} origin - 请求Origin值
 */
function addCorsHeaders(headers, origin) {
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Credentials', 'true');
  } else {
    headers.set('Access-Control-Allow-Origin', '*');
  }
  headers.set('Vary', 'Origin');
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
  let targetDomain;
  let useHttps;
  if (CONFIG.ACCEL_DOMAIN && CONFIG.ACCEL_SUBDOMAINS.includes(subdomain)) {
    // 加速：直接转发到加速接入域名，协议由 ACCEL_USE_HTTPS 单独控制
    targetDomain = CONFIG.ACCEL_DOMAIN;
    useHttps = CONFIG.ACCEL_USE_HTTPS;
  } else {
    // 旧逻辑：查子域名映射，未找到则回退到默认目标域名
    targetDomain = getTargetForSubdomain(subdomain);
    if (!targetDomain) {
      targetDomain = `${subdomain}.${CONFIG.TARGET_DOMAIN}`;
    }
    useHttps = CONFIG.USE_HTTPS;
  }
  // 构建目标URL
  const protocol = useHttps ? 'https' : 'http';
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

  // 如果启用了CORS，处理OPTIONS预检请求
  if (CONFIG.ENABLE_CORS && request.method === 'OPTIONS') {
    const corsHeaders = new Headers();
    addCorsHeaders(corsHeaders, request.headers.get('Origin'));
    const requestMethod = request.headers.get('Access-Control-Request-Method');
    corsHeaders.set('Access-Control-Allow-Methods', requestMethod || 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    const requestHeadersValue = request.headers.get('Access-Control-Request-Headers');
    if (requestHeadersValue) {
      corsHeaders.set('Access-Control-Allow-Headers', requestHeadersValue);
    } else {
      corsHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    }
    corsHeaders.set('Access-Control-Max-Age', '86400');
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // === WebSocket 升级代理处理 ===
  if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
    try {
      // 创建WebSocket对
      const wsPair = new WebSocketPair();
      const [client, server] = Object.values(wsPair);
      
      // 接受客户端连接
      server.accept();

      // 使用fetch建立到上游服务器的WebSocket连接
      const upstreamResponse = await fetch(targetUrl, {
        method: request.method,
        headers: requestHeaders,
        body: request.body,
      });

      if (!upstreamResponse.webSocket) {
        server.close(1011, 'Upstream server does not support WebSocket');
        return new Response('Upstream server does not support WebSocket', { status: 502 });
      }

      const upstreamSocket = upstreamResponse.webSocket;
      upstreamSocket.accept();

      // 双向消息转发
      server.addEventListener('message', ev => {
        try {
          if (upstreamSocket.readyState === WebSocket.READY_STATE_OPEN) {
            upstreamSocket.send(ev.data);
          }
        } catch (error) {
          console.error('Error forwarding message to upstream:', error);
          server.close(1011, 'Error forwarding to upstream');
        }
      });

      upstreamSocket.addEventListener('message', ev => {
        try {
          if (server.readyState === WebSocket.READY_STATE_OPEN) {
            server.send(ev.data);
          }
        } catch (error) {
          console.error('Error forwarding message to client:', error);
          upstreamSocket.close(1011, 'Error forwarding to client');
        }
      });

      // 处理连接关闭
      server.addEventListener('close', (event) => {
        try {
          if (upstreamSocket.readyState === WebSocket.READY_STATE_OPEN) {
            upstreamSocket.close(event.code, event.reason);
          }
        } catch (error) {
          console.error('Error closing upstream connection:', error);
        }
      });

      upstreamSocket.addEventListener('close', (event) => {
        try {
          if (server.readyState === WebSocket.READY_STATE_OPEN) {
            server.close(event.code, event.reason);
          }
        } catch (error) {
          console.error('Error closing client connection:', error);
        }
      });

      // 处理错误
      server.addEventListener('error', (error) => {
        console.error('Client WebSocket error:', error);
        try {
          if (upstreamSocket.readyState === WebSocket.READY_STATE_OPEN) {
            upstreamSocket.close(1011, 'Client error');
          }
        } catch {}
      });

      upstreamSocket.addEventListener('error', (error) => {
        console.error('Upstream WebSocket error:', error);
        try {
          if (server.readyState === WebSocket.READY_STATE_OPEN) {
            server.close(1011, 'Upstream error');
          }
        } catch {}
      });

      const wsResponseHeaders = new Headers();
      if (CONFIG.ENABLE_CORS) {
        addCorsHeaders(wsResponseHeaders, request.headers.get('Origin'));
      }
      return new Response(null, {
        status: 101,
        webSocket: client,
        headers: wsResponseHeaders
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

  // 处理多个 Set-Cookie 头 - Cloudflare Workers 需要特殊处理才能保留多个 cookie
  if (response.headers.has('set-cookie')) {
    responseHeaders.delete('set-cookie');
    let cookies = [];
    if (typeof response.headers.getAll === 'function') {
      cookies = response.headers.getAll('set-cookie');
    } else {
      const raw = response.headers.get('set-cookie');
      if (raw) cookies = [raw];
    }
    cookies.forEach(cookie => responseHeaders.append('set-cookie', cookie));
  }

  // 如果启用了CORS支持，添加CORS响应头
  if (CONFIG.ENABLE_CORS) {
    addCorsHeaders(responseHeaders, request.headers.get('Origin'));
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders
  });
}
