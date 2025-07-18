// Cloudflare Workers - 子域名动态反向代理

// 默认配置参数（可修改）
const DEFAULT_CONFIG = {
  // 默认目标域名（实际服务器的域名，如 *.mydomain.com）- 仅在找不到子域名映射时使用
  TARGET_DOMAIN: 'your.target.domain',
  
  // 是否使用HTTPS协议访问目标域名
  USE_HTTPS: true,
  
  // 需要进行内容替换的内容类型
  CONTENT_TYPES_TO_REPLACE: [
    'text/html'
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

  
  // 直接转发 OAuth/SSO，不做内容替换和自定义页面
  return fetch(targetUrl, request);
  
}