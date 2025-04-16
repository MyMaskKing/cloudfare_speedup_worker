// Cloudflare Workers - 子域名动态反向代理

// 默认配置参数（可修改）
const DEFAULT_CONFIG = {
  // 目标域名（实际服务器的域名，如 *.mydomain.com）- 如有环境变量会被覆盖
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
  
  // 构建目标URL
  const protocol = CONFIG.USE_HTTPS ? 'https' : 'http';
  const targetUrl = `${protocol}://${subdomain}.${CONFIG.TARGET_DOMAIN}${pathname}${url.search}`;
  
  // 转发请求
  return await proxyRequest(request, targetUrl, subdomain, proxyDomain, CONFIG);
}

/**
 * 代理请求到目标服务器
 * @param {Request} originalRequest - 原始请求
 * @param {string} targetUrl - 目标URL
 * @param {string} subdomain - 子域名前缀
 * @param {string} proxyDomain - 代理域名（从请求中获取）
 * @param {Object} config - 当前配置
 * @returns {Promise<Response>} - 修改后的响应
 */
async function proxyRequest(originalRequest, targetUrl, subdomain, proxyDomain, config) {
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
    
    // 处理内容类型
    const contentType = responseHeaders.get('content-type') || '';
    
    // 检查是否需要处理响应内容
    const shouldReplaceContent = config.CONTENT_TYPES_TO_REPLACE.some(type => contentType.includes(type));
    
    if (shouldReplaceContent) {
      // 获取响应文本
      let text = await response.text();
      
      // 执行内容替换：将目标域名替换为代理域名
      const sourcePattern = new RegExp(`${subdomain}\\.${config.TARGET_DOMAIN.replace(/\./g, '\\.')}`, 'g');
      text = text.replace(sourcePattern, `${subdomain}.${proxyDomain}`);
      
      // 返回修改后的响应
      return new Response(text, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      });
    }
    
    // 对于其他类型的内容，直接返回
    return response;
  } catch (error) {
    // 处理错误
    return new Response(config.ERROR_MESSAGES.PROXY_FAILED + error.message, { status: 500 });
  }
} 