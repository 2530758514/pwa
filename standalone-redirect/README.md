# 独立 H5 中转页

这是与 PWA 安装页分开部署的入口：显示黑底绿色加载动画，请求 `/api/pwa_h5_detail`，获取 `h5_url` 后携带入口参数跳转 H5。

## 访问统计

- 进入页面时记录本次访问时间，获取 detail 的有效绑定后，以 V1 协议向 `/api/web_pwa_statistics` 上报一次 `landing_view`。
- 复用主项目的统计客户端及 IndexedDB 队列，沿用稳定事件 ID、重试、批量确认和七天过期规则。不会上报 `install_click` 或 `standalone_launch`。
- 与现有协议一致：只有 detail 明确返回 `package_mode: pwa_first`、正整数 `pwa_id`（兼容 `id`）和 `pwa_url_id`，且设备可识别为 Android/iOS 时，才产生正式事件。`onelink`、缺失绑定或未知设备不伪造统计。
- 不从入口参数推导统计绑定 ID，不改变原来的跳转参数。
- 跳转前最多等待 200ms，让本地持久化及 keepalive 请求有机会开始；不等待统计响应。日志失败或本地存储不可用不阻止跳转。若页面被销毁前未持久化，请求又未发出，不能保证这次访问送达。
- detail 失败时无法取得有效绑定，不发送事件；手动重试成功后仍属于本次页面访问，不重复计数。浏览器重新加载页面属于新的访问。

## 参数与失败处理

- 优先级：入口 query > 入口 hash 中 `?` 后的 query > H5 地址同名参数。同名字段整体取胜，保留胜出来源的重复值和空值。
- 保留 H5 路径及 hash 路由；原样透传入口参数，包括广告参数，不生成 Facebook/BIGO 别名或新增 PWA 身份参数。
- detail 请求只携带固定 `lang: US`、`X-Os: web`、当前域名的 `X-Origin`，以及汇总入口参数的 `X-Landing-Params`。
- 接口每次超时 10 秒；网络、超时或 HTTP 5xx 失败后，间隔 1 秒、3 秒重试两次。其他失败显示英文提示及 Retry 按钮。
- H5 地址只接受 HTTP(S) 绝对地址，不使用缓存或硬编码目标兜底。
- 不注册 Service Worker，不加载广告 SDK。最终 H5 负责广告归因与其他业务事件。

## 部署

只将本目录的 **index.html** 部署到独立站点根目录。文件内已嵌入共享统计代码，无需原 PWA 的构建产物、manifest 或其他 JavaScript 文件。

新域名需要在后端配置正确的 PWA 绑定及目标 H5，同时代理两个接口：

```nginx
root /var/www/h5-redirect;
index index.html;

location = / {
    add_header Cache-Control "no-cache" always;
    try_files /index.html =404;
}

location = /index.html {
    add_header Cache-Control "no-cache" always;
}

location = /api/pwa_h5_detail {
    proxy_pass https://YOUR_BACKEND_HOST/pwa_h5_detail;
    proxy_ssl_server_name on;
    proxy_set_header Host YOUR_BACKEND_HOST;
    proxy_set_header X-Origin $http_x_origin;
    proxy_set_header X-Landing-Params $http_x_landing_params;
    proxy_cache off;
    proxy_hide_header Cache-Control;
    add_header Cache-Control "no-store" always;
}

location = /api/web_pwa_statistics {
    proxy_pass https://YOUR_BACKEND_HOST/web_pwa_statistics;
    proxy_ssl_server_name on;
    proxy_set_header Host YOUR_BACKEND_HOST;
    proxy_set_header X-Origin $http_x_origin;
    proxy_cache off;
    proxy_hide_header Cache-Control;
    add_header Cache-Control "no-store" always;
}
```

将示例后端域名替换为实际配置。代理需保留请求方法、统计 JSON 和 Cookie；后端需支持 V1 批量事件及逐条确认响应。不要启用 detail/统计接口缓存，入口 CDN 和短链接需要保留完整 query。

## 维护与验证

共享统计客户端变更后同步嵌入代码；页面仍然是单文件部署：

```powershell
node scripts/sync-standalone-statistics.mjs
node scripts/sync-standalone-statistics.mjs --check
node --test standalone-redirect/verify.mjs tests/pwaStatisticsV1.test.mjs
```

验证脚本执行页面实际内联代码，以内存队列代替 IndexedDB，覆盖参数透传、访问统计、重试及跳转兜底。上线仍需在真实域名验证两个代理接口、移动端 IndexedDB/keepalive 和后台统计结果。
