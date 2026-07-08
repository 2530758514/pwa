# Standalone PWA Shell

## Android install testing

Android Chrome can install the PWA only from a secure context. A normal LAN URL such as `http://192.168.x.x:4010/pwa` is not secure, so the install prompt will not appear.

Use one of these paths:

1. Production-like test: deploy `dist` to an HTTPS domain and open `https://your-domain/pwa` in Android Chrome.
2. Local USB test:
   - Enable USB debugging on the Android phone.
   - Run `adb reverse tcp:4010 tcp:4010`.
   - Run `npm run dev:android`.
   - Open `http://127.0.0.1:4010/pwa` in Android Chrome on the phone.

The phone-side `127.0.0.1` URL is treated as a trustworthy local origin, so service workers and the PWA install prompt can work. If you open the Windows LAN IP over plain HTTP, service worker registration and PWA installation are expected to fail.

## Manifest strategy

The install manifest defaults to the `config_url` returned by `/pwa_h5_detail`. The shell fetches that remote manifest, normalizes it for the current PWA shell, and stores it behind the same-origin `/pwa-dynamic-manifest.webmanifest` path for Chrome's install checks.

Remote display fields such as `name`, `short_name`, `description`, `icons`, `screenshots`, `theme_color`, and `background_color` are kept. Shell identity fields are fixed to this project: `start_url=/pwa`, `scope=/`, `id=/pwa`, and the `web+hslot` protocol handler opens `/pwa`. This keeps Android Chrome's install checks aligned with the service worker and ensures the installed app launches the iframe shell.

`/manifest.webmanifest` is only the first-load fallback. The service worker keeps `/pwa-dynamic-manifest.webmanifest` installable even before the remote config is ready by falling back to the static manifest instead of returning 404.

If `config_url` is cross-origin, the manifest host must allow CORS from the PWA shell domain. The default link/fetch mode is anonymous; set `VITE_PWA_MANIFEST_CROSSORIGIN=use-credentials` only when that manifest host requires cookies and sends credentialed CORS headers.

## Production deploy checklist

PWA installability is checked against the files that the browser receives from the public origin, not only the latest built assets. After deploying, verify these root-level files:

- `/pwa` must return the current `index.html` and reference the latest built JS/CSS.
- `/sw.js` must be the standalone shell service worker and contain `pwa-shell-runtime-v2`. Serve it with `Content-Type: application/javascript` and `Cache-Control: no-cache` or `no-store`; purge CDN cache after each deploy.
- `/manifest.webmanifest` and `/pwa-dynamic-manifest.webmanifest` must return 200 JSON with `Content-Type: application/manifest+json` or `application/json`.
- `/pwa-icons/icon-192.png` and `/pwa-icons/icon-512.png` must return 200 images.
- The server must fallback `/pwa` and other app routes to `index.html`, but must not fallback `*.webmanifest`, `/sw.js`, or icon files to HTML.

If Android Chrome has already seen an old service worker, clear site data or unregister the old service worker before retesting. A stale `/sw.js` can keep returning an old dynamic-manifest 404 even when the page HTML has already updated.
