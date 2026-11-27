# Facebook 分享标题：Nginx / 宝塔部署

此配置让一份 dist 在不同域名下返回不同分享标题，图片继续使用现有 OSS 地址。不是运行 Vue 后修改，而是在 Nginx 返回初始 HTML 时替换，所以 Facebook 能直接读取。

规则只去掉 hostname 最后一段后缀，保留前面的子域名，按本次需求不是取注册主域名：

| 访问域名 | 标题 |
| --- | --- |
| spinvibe777.spin7m.com | Online Slots at spinvibe777.spin7m\| 700+ Real Money Slot Games |
| vegasslots777us.com | Online Slots at vegasslots777us\| 700+ Real Money Slot Games |
| pwa007.draft7bk.uk | Online Slots at pwa007.draft7bk\| 700+ Real Money Slot Games |

## 安装一次

1. 上传本次构建的完整 dist。
2. 用 `nginx -V` 确认有 `--with-http_sub_module`。宝塔的 Nginx 路径通常为 `/www/server/nginx/sbin/nginx`，以实际安装为准。若没有这个模块，需由运维启用后再添加配置。
3. 将本目录两个 conf 文件放在服务器配置目录，例如 `/www/server/nginx/conf/pwa-share/`。不要放进会被宝塔自动当作完整站点加载的 vhost 通配目录。
4. 在主 nginx.conf 的 `http {}` 内、站点 include 之前增加一次：

```nginx
include /www/server/nginx/conf/pwa-share/facebook-share-title-http.conf;
```

5. 在每个 PWA 站点的现有 `location = /index.html {}` 中加入 HTML 片段。没有这个 location 时可新增，根目录沿用站点 server 的现有 root：

```nginx
location = /index.html {
    include /www/server/nginx/conf/pwa-share/facebook-share-title-html.conf;
    # 保留站点已有的 HTML 缓存/安全响应头。
}
```

保留原 `index index.html`、`try_files`、HTTP→HTTPS、证书和 API 代理配置。默认首页与 SPA fallback 应内部转到 `/index.html`。如果首页由其他 location 的 alias、rewrite 或直接返回 HTML 提供，请把 HTML include 放进真正返回 index.html 的 location；不要增加一套替代现有 API 路由的通用配置。

如果此 HTML location 原来启用了 `gzip_static` 或 `brotli_static`，应在这个 location 关闭对应的静态预压缩输出，确保替换发生在未压缩 HTML 上；动态 gzip 可以保留。不要为不存在的可选模块添加未知指令。

6. 执行 `nginx -t`，成功后再重新加载配置。此仓库不会自动修改或重载你的服务器。

新增域名复用同样的站点规则和 include 即可，不需要前端重编译或维护域名名单。站点缓存/CDN 缓存键须按 host 区分；发布后清理旧 HTML 缓存，并在 Facebook Sharing Debugger 对实际分享链接重新抓取。

## 验收

```sh
curl -s 'https://spinvibe777.spin7m.com/?fbclid=check' | grep 'og:title'
curl -s 'https://pwa007.draft7bk.uk/?campaign=check' | grep 'og:title'
```

响应应包含本域名对应标题及原 OSS `og:image`。URL 的路径、参数、hash 不参与标题生成，页面路由和广告归因仍由原代码处理。

未安装 Nginx 配置时，前端输出空的 og:title 和 title，不出现 Loading，也不会露出未替换的占位字符串；此时不会自动生成所需标题。localhost、IP 和不匹配的主机名保持空标题。
