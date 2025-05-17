// Cloudflare Workers - 子域名动态反向代理

// 默认配置参数（可修改）
const DEFAULT_CONFIG = {
  // 默认目标域名（实际服务器的域名，如 *.mydomain.com）- 仅在找不到子域名映射时使用
  TARGET_DOMAIN: 'your.target.domain',
  
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

// 生成OAuth提示页面
function renderOAuthHintPage(targetUrl) {
  return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>认证提示</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2em;
          line-height: 1.6;
        }
        
        .box {
          background: rgba(255, 255, 255, 0.95);
          border-radius: 16px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
          backdrop-filter: blur(10px);
          max-width: 580px;
          width: 100%;
          padding: 2.5em;
          animation: fadeIn 0.6s ease-out;
          border: 1px solid rgba(255, 255, 255, 0.3);
        }
        
        .icon {
          width: 64px;
          height: 64px;
          margin: 0 auto 1.5em;
          display: block;
          color: #4A90E2;
          animation: pulse 2s infinite ease-in-out;
        }
        
        h2 {
          color: #2C3E50;
          font-size: 1.75em;
          margin-bottom: 1em;
          text-align: center;
          font-weight: 600;
        }
        
        p {
          color: #34495E;
          margin-bottom: 1.2em;
          font-size: 1.1em;
        }
        
        .steps {
          background: rgba(74, 144, 226, 0.05);
          border-radius: 12px;
          padding: 1.5em;
          margin: 1.5em 0;
        }
        
        .steps ol {
          margin: 0;
          padding-left: 1.2em;
        }
        
        .steps li {
          margin-bottom: 0.8em;
          color: #34495E;
        }
        
        .steps li:last-child {
          margin-bottom: 0;
        }
        
        .btn {
          display: inline-block;
          background: linear-gradient(135deg, #4A90E2 0%, #357ABD 100%);
          color: white;
          text-decoration: none;
          padding: 0.8em 2em;
          border-radius: 8px;
          font-weight: 500;
          margin: 1em 0;
          transition: all 0.3s ease;
          text-align: center;
          width: 100%;
          cursor: pointer;
        }
        
        .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(74, 144, 226, 0.3);
        }
        
        .tip {
          font-size: 0.95em;
          color: #7f8c8d;
          background: rgba(0, 0, 0, 0.03);
          padding: 1em;
          border-radius: 8px;
          margin-top: 1.5em;
        }
        
        @media (max-width: 480px) {
          .box {
            padding: 2em;
          }
          h2 {
            font-size: 1.5em;
          }
        }
      </style>
    </head>
    <body>
      <div class="box">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        <h2>请使用原服务器地址进行认证</h2>
        <p>当前页面为代理环境，为确保您的账号安全，OAuth 认证流程需要在原服务器地址下完成。</p>
        
        <div class="steps">
          <ol>
            <li>点击下方按钮将在<strong>新窗口</strong>打开 原服务器 页面</li>
            <li>原服务器页面 完成认证后，将会自动注册<strong>本网站的账户</strong>，请手动修改本网站<strong>账户及密码</strong></li>
            <li>修改完成后可以<strong>关闭本窗口</strong>，<strong>使用账户密码</strong>即可进入代理环境的系统</li>
          </ol>
        </div>
        
        <a href="${targetUrl}" class="btn" target="_blank">前往原服务器进行认证</a>
        
        <div class="tip">
          <p style="margin: 0; font-size: 0.95em;">💡 提示：访问原服务器页面时，如遇网络问题，可使用 VPN 加速访问。</p>
          <p style="margin: 0; font-size: 0.95em;">⭐ 代理环境和原服务器区别：使用相同的账户密码(指的是网站的账户密码，非OAuth认证的账户密码)，代理环境因安全因素，无法进行OAuth认证。</p>
        </div>
      </div>
    </body>
    </html>
  `;
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
  
  // 从请求中获取代理域名（移除子域名部分）
  const proxyDomain = hostname.substring(subdomain.length + 1);
  
  // 尝试获取此子域名的目标域名映射
  let targetDomain = getTargetForSubdomain(subdomain);
  
  // 如果没有找到映射，则使用默认目标域名
  if (!targetDomain) {
    targetDomain = `${subdomain}.${CONFIG.TARGET_DOMAIN}`;
  }
  
  // 构建目标URL
  const protocol = CONFIG.USE_HTTPS ? 'https' : 'http';
  const targetUrl = `${protocol}://${targetDomain}${pathname}${url.search}`;
  
  // 检查是否为OAuth/SSO相关回调
  if (
    ['sso_callback', 'oauth', 'callback'].some(key => pathname.includes(key)) ||
    (pathname.includes('/api/auth/sso'))
  ) {
    const html = renderOAuthHintPage(`${protocol}://${targetDomain}`);
    return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
  }
  
  // 转发请求
  return await proxyRequest(request, targetUrl, subdomain, proxyDomain, targetDomain, CONFIG);
}

/**
 * 代理请求到目标服务器
 * @param {Request} originalRequest - 原始请求
 * @param {string} targetUrl - 目标URL
 * @param {string} subdomain - 子域名前缀
 * @param {string} proxyDomain - 代理域名（从请求中获取）
 * @param {string} targetDomain - 目标域名
 * @param {Object} config - 当前配置
 * @returns {Promise<Response>} - 修改后的响应
 */
async function proxyRequest(originalRequest, targetUrl, subdomain, proxyDomain, targetDomain, config) {
  // 复制原始请求头
  const requestHeaders = new Headers(originalRequest.headers);

  // Host 头修正
  requestHeaders.set('Host', new URL(targetUrl).host);

  // 保证 Origin/Referer 头指向目标域名
  if (requestHeaders.has('Origin')) {
    try {
      const originUrl = new URL(requestHeaders.get('Origin'));
      originUrl.host = new URL(targetUrl).host;
      requestHeaders.set('Origin', originUrl.toString());
    } catch {}
  }
  if (requestHeaders.has('Referer')) {
    try {
      const refererUrl = new URL(requestHeaders.get('Referer'));
      refererUrl.host = new URL(targetUrl).host;
      requestHeaders.set('Referer', refererUrl.toString());
    } catch {}
  }

  // 创建新的请求
  const modifiedRequest = new Request(targetUrl, {
    method: originalRequest.method,
    headers: requestHeaders,
    body: originalRequest.body,
    redirect: 'manual' // 让 Worker 处理重定向
  });

  try {
    let response = await fetch(modifiedRequest);
    const responseHeaders = new Headers(response.headers);

    // 多 Set-Cookie 头处理
    if (response.headers.has('set-cookie')) {
      // getAll 兼容性处理
      let cookies = [];
      if (typeof response.headers.getAll === 'function') {
        cookies = response.headers.getAll('set-cookie');
      } else {
        // 兼容旧环境
        const raw = response.headers.get('set-cookie');
        if (raw) cookies = [raw];
      }
      cookies.forEach(cookie => responseHeaders.append('set-cookie', cookie));
    }

    // 处理重定向
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      let location = responseHeaders.get('Location');
      if (location && location.includes(targetDomain)) {
        location = location.replace(targetDomain, `${subdomain}.${proxyDomain}`);
        responseHeaders.set('Location', location);
      }
    }

    // CORS 支持
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Credentials', 'true');

    // 内容替换逻辑
    const contentType = responseHeaders.get('content-type') || '';
    const shouldReplaceContent = config.CONTENT_TYPES_TO_REPLACE.some(type => contentType.includes(type));
    if (shouldReplaceContent) {
      let text = await response.text();
      const targetHost = new URL(targetUrl).hostname;
      const sourcePattern = new RegExp(targetHost.replace(/\./g, '\\.'), 'g');
      text = text.replace(sourcePattern, `${subdomain}.${proxyDomain}`);
      return new Response(text, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      });
    }
    // 其他类型内容直接返回
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    });
  } catch (error) {
    return new Response(config.ERROR_MESSAGES.PROXY_FAILED + error.message, { status: 500 });
  }
} 