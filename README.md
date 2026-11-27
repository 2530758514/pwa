# Standalone PWA Shell

## Android install testing

Android Chrome can install the PWA only from a secure context. A normal LAN URL such as `http://192.168.x.x:4010/` is not secure, so the install prompt will not appear.

Use one of these paths:

1. Production-like test: deploy `dist` to an HTTPS domain and open `https://your-domain/` in Android Chrome.
2. Local USB test:
   - Enable USB debugging on the Android phone.
   - Run `adb reverse tcp:4010 tcp:4010`.
   - Run `npm run dev:android`.
   - Open `http://127.0.0.1:4010/` in Android Chrome on the phone.

The phone-side `127.0.0.1` URL is treated as a trustworthy local origin, so service workers and the PWA install prompt can work. If you open the Windows LAN IP over plain HTTP, service worker registration and PWA installation are expected to fail.

## Manifest strategy

The first page load uses `/manifest.webmanifest` so Chrome can always detect a valid manifest before `/pwa_h5_detail` resolves. After `/pwa_h5_detail` returns `config_url`, the shell fetches that remote manifest with a versioned no-store request, merges the install fields returned by the detail API, and switches the manifest link to a versioned dynamic manifest when the service worker can serve it. If the service worker is not controlling the page yet, the shell falls back to the versioned backend manifest URL.

Remote display fields such as `name`, `short_name`, `description`, and `icons` are kept. Install `screenshots` are shell-owned local assets. The shell normalizes `theme_color` and `background_color` to black so the installed app keeps one status-bar and startup surface across embedded H5 templates. Shell launch fields are fixed to this root-entry project: `start_url=/`, `scope=/`, and the `web+hslot` protocol handler opens `/`. A same-origin remote manifest `id` is kept when available so dynamic app identity can still differ by backend config.

The richer system install dialog uses the four local `/pwa-source/1.png` through `/pwa-source/4.png` screenshots. `/pwa_h5_detail` carousel images can still render on the landing page, but they do not override the system install screenshots.

Two release variants are available. `npm run build:tetris` writes the Tetris-enabled package to `dist-tetris`, while `npm run build:standard` writes the package without the Tetris landing overlay to `dist-standard`. `npm run build:variants` builds both. The build-time switch is `VITE_ENABLE_TETRIS_LANDING`; the normal `npm run build` keeps the existing enabled-by-default behavior.

`/manifest.webmanifest` is the first-load fallback. `/pwa-dynamic-manifest.webmanifest` is the preferred install manifest after dynamic data has been resolved because it contains the normalized API fields. When `/pwa_h5_detail` returns `icon`, the generated install manifest uses that icon and does not mix in the local `/pwa-icons/*` fallback icons. The returned `config_url` is kept as the network fallback when the dynamic manifest cannot be served yet.

If `config_url` is cross-origin, the manifest host must allow CORS from the PWA shell domain. The default link/fetch mode is anonymous; set `VITE_PWA_MANIFEST_CROSSORIGIN=use-credentials` only when that manifest host requires cookies and sends credentialed CORS headers.

## Production deploy checklist

PWA installability is checked against the files that the browser receives from the public origin, not only the latest built assets. After deploying, verify these root-level files:

- `/` must return the current `index.html` and reference the latest built JS/CSS.
- `/sw.js` must be the standalone shell service worker and contain `pwa-shell-runtime-v12`. Serve it with `Content-Type: application/javascript` and `Cache-Control: no-cache` or `no-store`; purge CDN cache after each deploy.
- `/manifest.webmanifest` must return 200 JSON with `Content-Type: application/manifest+json` or `application/json`.
- The `config_url` returned by `/pwa_h5_detail` must return 200 JSON with CORS enabled when it is cross-origin. The current expected form is a URL like `https://static.gold7p.com/pwa/24/20/manifest.webmanifest`.
- `/pwa-dynamic-manifest.webmanifest` is only a service-worker generated fallback. It is not the normal backend config file.
- `/pwa-icons/icon-192.png` and `/pwa-icons/icon-512.png` must return 200 images.
- The server must fallback app routes to `index.html`, but must not fallback `*.webmanifest`, `/sw.js`, or icon files to HTML.

If Android Chrome has already seen an old service worker, clear site data or unregister the old service worker before retesting. A stale `/sw.js` can keep returning an old dynamic-manifest 404 even when the page HTML has already updated.


## 界面版与白屏跳转版

`VITE_SHOW_PWA_LANDING` 是构建开关，默认 `false`；设为 `true` 展示原落地页。它不是 URL 参数，两个版本需分别构建、分别部署。

| 命令 | 产物 | 行为 |
| --- | --- | --- |
| `npm run build:blank` | `dist-blank/` | 白屏入口，Facebook 中先显示浏览器引导 |
| `npm run build:landing` | `dist-landing/` | 原标准落地页 |
| `npm run build:standard` | `dist-standard/` | 保持原标准界面版 |
| `npm run build:tetris` | `dist-tetris/` | 保持原俄罗斯方块界面版 |

本地预览：`npm run preview:blank`（4011）和 `npm run preview:landing`（4012）。部署上传对应目录的全部产物，包括 `sw.js` 和 manifest，不使用 `standalone-redirect/index.html`。两个发布应使用各自配置正确的站点域名，保留原 PWA 的 API 代理配置；本地预览也需要可用的后端代理。

白屏版只改变普通浏览器入口：Android 和 iOS Facebook 显示白屏专属金色 Open in Browser 引导，分别尝试打开 Chrome 和 Safari，在 Facebook 内不跳 H5。外部浏览器取得新配置后，沿用原参数与归因处理自动进入 H5；统计最多等待 200 毫秒，不自动产生安装点击或下载事件。已安装 PWA 及桌面启动链接仍进入原 iframe 壳。

白屏版通过 Chrome Intent 或 Safari 私有协议尝试外部打开，保留失败时使用 Facebook 菜单打开浏览器的说明，不把发起跳转当作唤起成功。原界面版仍保留旧引导组件与复制链接方式。Chrome Intent 和 Safari 交接效果需真机验证。

验证命令：`node --test tests/*.test.mjs standalone-redirect/verify.mjs`。

浏览器回归：先启动两个预览，再用 Playwright CLI 执行 `run-code --filename scripts/verify-landing-browser.cjs`。脚本使用模拟接口，覆盖十种入口场景并在 `output/` 保存截图，不代表真实后端或真机验收。

开发、Android 调试、测试和正式环境均显式配置 `VITE_SHOW_PWA_LANDING=false`。`npm run dev` 默认白屏；`npm run build:test` 使用 test 模式输出 `dist/` 白屏包；`npm run build` 使用 production 模式输出 `dist/` 白屏包。环境变量在启动/构建时读取，修改后需重启或重新构建。明确指定样式的 `build:landing`、`build:standard`、`build:tetris` 会强制开启原界面，不受环境文件中 false 的影响。

### 白屏版 Facebook 金色引导

白屏入口使用独立的金色底部弹窗和纯黑遮罩，没有关闭按钮、取消或安装教程；原界面版的浏览器引导保持不变。奖励只展示本次 detail 成功返回的 `download_reward_amount`，缺失或非法时不显示金额区域，零金额正常显示。

白屏入口挂载后先立即尝试一次 Android Chrome Intent 或 iOS HTTPS Safari 协议，紧接着正常挂载金色引导及其图片，不增加定时等待。切到后台时暂不显示引导，返回后显示但不再次自动唤起；配置刷新也不重复唤起。按钮点击允许主动重试，短时间重复点击会节流。iOS HTTP 入口由服务器强制跳转 HTTPS，前端不维护域名名单。失败或取消不关闭弹窗，也不在 Facebook 内跳 H5。系统提示与真实浏览器交接仍需 HTTPS 真机验收。

金色弹窗组件回归：运行 `npx vite --port 4013`，再用 Playwright CLI 执行 `run-code --filename scripts/verify-blank-guide-browser.cjs`，覆盖金额更新、零金额、长金额、无效数据、图片失败与窄屏/横屏，截图输出在 `output/`。

### Facebook 分享图片与 HTTP 广告入口

分享图统一使用公开 OSS/CDN 地址 `https://static.gold7p.com/assets2/assets/pwa/facebook-cover.png`（800×480）。本地 `public/share/facebook-cover.png` 保留为同内容副本。构建按 `VITE_FACEBOOK_SHARE_IMAGE_URL` 将完整图片 URL 写入初始 HTML 的 Open Graph 标签；不改变页面标题或业务事件。未配置时不额外注入图片标签。

开发、Android 调试、测试、正式及配置示例均使用同一 OSS 图片 URL，分享链接可使用不同域名；不需要为新增广告域名重新配置图片地址。`npm run build` 和 `npm run build:test` 均将此 URL 写入构建产物。发布后使用 Facebook Sharing Debugger 重新抓取实际分享链接。OSS 地址须保持公开可访问，不能要求登录或拦截 Facebook 爬虫；当前响应经过 CloudFront 并有长期缓存，更换图片建议使用新文件名或版本 URL，并刷新 CDN/Facebook 缓存。

HTTP → HTTPS 由服务器统一重定向，前端不维护域名名单或自动转换规则。新增落地页域名只需部署同样的站点、配置 HTTPS 和后端绑定，不必为适配域名重新打包；浏览器唤起沿用当前访问地址及广告参数。多个落地页域名可以共用同一个公开分享图片 URL，图片资源地址保持可访问即可。

静态构建不写固定标题；主入口与旧中转页的初始 `<title>` 均留空，避免输出 Loading 或默认项目名。主入口可按下节的服务器配置生成分享标题。运行中的 PWA 仍可按接口设置应用名称。Facebook 可能自行显示域名或选取其他文字，已有 Loading 缓存需在发布后通过 Sharing Debugger 对实际分享链接重新抓取；前端无法强制清除 Facebook 的缓存。

### 按访问域名显示 Facebook 分享标题

分享标题为 `Online Slots at {hostname去掉最后一段后缀}| 700+ Real Money Slot Games`，例如 `spinvibe777.spin7m.com` 对应 `spinvibe777.spin7m`。前端保留空标题标记，由 Nginx 在响应 HTML 时填充；一份包可复用到多个域名，无需按域名重新构建。配置及宝塔安装步骤见 [deploy/nginx/README.md](deploy/nginx/README.md)。未安装服务器配置时仍为空标题，前端无法替代这一步让 Facebook 动态抓取域名标题。
