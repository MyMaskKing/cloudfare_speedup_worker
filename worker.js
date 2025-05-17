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
  
  // 创建新的请求
  const modifiedRequest = new Request(targetUrl, {
    method: originalRequest.method,
    headers: requestHeaders,
    body: originalRequest.body,
    redirect: 'follow'
  });

  try {
    // 获取目标服务器的响应
    let response = await fetch(modifiedRequest);
    
    // 复制响应头
    const responseHeaders = new Headers(response.headers);
    
    // 1. 自动处理CSP，允许CDN图片
    let csp = responseHeaders.get('content-security-policy');
    if (csp) {
      csp = csp.replace(
        /img-src([^;]*);?/,
        (match, p1) => {
          return `img-src${p1} https://jsd.nn.ci https://cdn.jsdelivr.net;`;
        }
      );
      responseHeaders.set('content-security-policy', csp);
    } else {
      responseHeaders.set(
        'content-security-policy',
        "img-src 'self' data: blob: https://jsd.nn.ci https://cdn.jsdelivr.net;"
      );
    }

    // 2. 保证set-cookie头完整
    if (response.headers.has('set-cookie')) {
      responseHeaders.set('set-cookie', response.headers.get('set-cookie'));
    }

    // 处理内容类型
    const contentType = responseHeaders.get('content-type') || '';
    const shouldReplaceContent = config.CONTENT_TYPES_TO_REPLACE.some(type => contentType.includes(type));
    if (shouldReplaceContent) {
      // 获取响应文本
      let text = await response.text();
      // 提取目标主机名用于替换
      const targetHost = new URL(targetUrl).hostname;
      // 执行内容替换：将目标域名替换为代理域名
      const sourcePattern = new RegExp(targetHost.replace(/\./g, '\\.'), 'g');
      text = text.replace(sourcePattern, `${subdomain}.${proxyDomain}`);
      // 返回修改后的响应
      return new Response(text, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      });
    }
    // 对于其他类型的内容，直接返回
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    });
  } catch (error) {
    // 处理错误
    return new Response(config.ERROR_MESSAGES.PROXY_FAILED + error.message, { status: 500 });
  }
} 