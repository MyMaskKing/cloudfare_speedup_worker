// Cloudflare Workers - 子域名动态反向代理

// 配置参数（可修改）
const CONFIG = {
  // 代理域名（访问的域名，如 *.proxy.cn）
  PROXY_DOMAIN: 'wemaskking.dpdns.org',
  
  // 目标域名（实际服务器的域名，如 *.mydomain.com）
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
    INVALID_DOMAIN: '不支持的域名格式，请使用正确的代理域名',
    INVALID_SUBDOMAIN: '无效的子域名',
    PROXY_FAILED: '代理请求失败: '
  }
};

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
  const url = new URL(request.url);
  const hostname = url.hostname;
  const pathname = url.pathname;
  
  // 检查是否匹配代理域名格式
  if (!hostname.endsWith(CONFIG.PROXY_DOMAIN)) {
    return new Response(CONFIG.ERROR_MESSAGES.INVALID_DOMAIN, { status: 400 });
  }
  
  // 提取子域名前缀
  const subdomain = hostname.split('.')[0];
  if (!subdomain) {
    return new Response(CONFIG.ERROR_MESSAGES.INVALID_SUBDOMAIN, { status: 400 });
  }
  
  // 构建目标URL
  const protocol = CONFIG.USE_HTTPS ? 'https' : 'http';
  const targetUrl = `${protocol}://${subdomain}.${CONFIG.TARGET_DOMAIN}${pathname}${url.search}`;
  
  // 转发请求
  return await proxyRequest(request, targetUrl, subdomain);
}

/**
 * 代理请求到目标服务器
 * @param {Request} originalRequest - 原始请求
 * @param {string} targetUrl - 目标URL
 * @param {string} subdomain - 子域名前缀
 * @returns {Promise<Response>} - 修改后的响应
 */
async function proxyRequest(originalRequest, targetUrl, subdomain) {
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
    const shouldReplaceContent = CONFIG.CONTENT_TYPES_TO_REPLACE.some(type => contentType.includes(type));
    
    if (shouldReplaceContent) {
      // 获取响应文本
      let text = await response.text();
      
      // 执行内容替换：将目标域名替换为代理域名
      const sourcePattern = new RegExp(`${subdomain}\\.${CONFIG.TARGET_DOMAIN.replace(/\./g, '\\.')}`, 'g');
      text = text.replace(sourcePattern, `${subdomain}.${CONFIG.PROXY_DOMAIN}`);
      
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
    return new Response(CONFIG.ERROR_MESSAGES.PROXY_FAILED + error.message, { status: 500 });
  }
} 