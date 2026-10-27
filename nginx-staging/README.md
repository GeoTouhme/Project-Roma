# W1 — Host Nginx Cloudflare Real-IP + Identity Sanitization (F2/F4 prep)

Staged configs — NOT deployed. Files:
- cloudflare-realip.conf      -> deploy to /etc/nginx/snippets/cloudflare-realip.conf
- proxy-identity-headers.conf -> deploy to /etc/nginx/snippets/proxy-identity-headers.conf
- balport.conf                -> target /etc/nginx/sites-available/balport (replaces live file)

## Deploy procedure (authorized change only)
1. Backup:    cp -a /etc/nginx/sites-available/balport /etc/nginx/sites-available/balport.bak-$(date +%Y%m%d-%H%M%S)
2. Copy snippets to /etc/nginx/snippets/
3. Copy balport.conf with REAL_IP_SNIPPET/IDENTITY_SNIPPET replaced by the real snippet paths
4. Validate: nginx -t          (MUST pass before reload)
5. Reload:    systemctl reload nginx   (zero downtime)
6. Verify:    tail /var/log/nginx/access.log — client IPs must be real (not CF edge)
             curl https://balportliquors.com/ -> 200, https://api.balportliquors.com/api/store/status -> 200

## Rollback
cp /etc/nginx/sites-available/balport.bak-<ts> /etc/nginx/sites-available/balport && nginx -t && systemctl reload nginx
(The balport symlink in sites-enabled points at sites-available; it is untouched.)

## What W1 does
- $remote_addr becomes the REAL client IP (realip + CF ranges, v4+v6, fetched 2026-10-24)
- X-Real-IP / XFF emitted to ALL upstreams = the single validated identity
- CF-Connecting-IP stripped before reaching Express
- Direct-to-origin (non-CF) requests keep their true socket IP as identity — no spoofing possible

## W1 does NOT do (separate authorizations)
- F4 Cloudflare-only allow-list (deny non-CF origin traffic on 443)
- Panel nginx passthrough (W3 — panel rebuild)

## Rollout order (agreed)
W4/W5 commit + backend deploy -> W1 nginx reload -> W3 panel rebuild -> matrix verify