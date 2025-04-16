我想要针对cloudfare的worker里面做一个反向代理，下面是示例代码，你要优化，变成一个可以代理多个网站，并且告诉我如何使用

# 流程演示

worker的路由：*.proxy.cn/*

访问blog.proxy.cn
将会转发：blog.mydomain.com

代码中proxy.cn和mydomain.com是固定的，域名的前缀是动态的

"""
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});
 
async function handleRequest(request) {
  const url = new URL(request.url);
 
  // 指定目标反向代理的 URL
  const targetUrl = `https://example.com${url.pathname}`;
 
  // 创建一个新的请求
  const modifiedRequest = new Request(targetUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    redirect: 'follow'
  });
 
  // 获取目标服务器的响应
  let response = await fetch(modifiedRequest);
 
  // 检查响应类型并重写内容
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html') || contentType.includes('text/css') || contentType.includes('application/javascript')) {
    // 将响应内容转为文本
    let text = await response.text();
 
    // 替换内容：例如，将 example.com 替换为 yoursite.com
    text = text.replace(/example\.com/g, 'yoursite.com');
 
    // 返回修改后的响应
    return new Response(text, {
      status: response.status,
      headers: response.headers
    });
  }
 
  // 如果不是需要重写的类型，则直接返回原始响应
  return response;
}
"""