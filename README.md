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

Remote display fields such as `name`, `short_name`, `description`, `icons`, `screenshots`, `theme_color`, and `background_color` are kept. Shell launch fields are fixed to this root-entry project: `start_url=/`, `scope=/`, and the `web+hslot` protocol handler opens `/`. A same-origin remote manifest `id` is kept when available so dynamic app identity can still differ by backend config.

`/manifest.webmanifest` is the first-load fallback. `/pwa-dynamic-manifest.webmanifest` is the preferred install manifest after dynamic data has been resolved because it contains the normalized API fields. When `/pwa_h5_detail` returns `icon`, the generated install manifest uses that icon and does not mix in the local `/pwa-icons/*` fallback icons. The returned `config_url` is kept as the network fallback when the dynamic manifest cannot be served yet.

If `config_url` is cross-origin, the manifest host must allow CORS from the PWA shell domain. The default link/fetch mode is anonymous; set `VITE_PWA_MANIFEST_CROSSORIGIN=use-credentials` only when that manifest host requires cookies and sends credentialed CORS headers.

## Production deploy checklist

PWA installability is checked against the files that the browser receives from the public origin, not only the latest built assets. After deploying, verify these root-level files:

- `/` must return the current `index.html` and reference the latest built JS/CSS.
- `/sw.js` must be the standalone shell service worker and contain `pwa-shell-runtime-v3`. Serve it with `Content-Type: application/javascript` and `Cache-Control: no-cache` or `no-store`; purge CDN cache after each deploy.
- `/manifest.webmanifest` must return 200 JSON with `Content-Type: application/manifest+json` or `application/json`.
- The `config_url` returned by `/pwa_h5_detail` must return 200 JSON with CORS enabled when it is cross-origin. The current expected form is a URL like `https://static.gold7p.com/pwa/24/20/manifest.webmanifest`.
- `/pwa-dynamic-manifest.webmanifest` is only a service-worker generated fallback. It is not the normal backend config file.
- `/pwa-icons/icon-192.png` and `/pwa-icons/icon-512.png` must return 200 images.
- The server must fallback app routes to `index.html`, but must not fallback `*.webmanifest`, `/sw.js`, or icon files to HTML.

If Android Chrome has already seen an old service worker, clear site data or unregister the old service worker before retesting. A stale `/sw.js` can keep returning an old dynamic-manifest 404 even when the page HTML has already updated.
