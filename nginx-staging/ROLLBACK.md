# F2 Rollout — Rollback Procedures (recorded BEFORE any change)

## Rollback images (all verified present)
- backend:      project-roma-backend:f6-verified-20261024 (4818a241c4ff)  == currently running
- backend W4:   project-roma-backend:w4-staged-20261024  (524dfe8a75b1)
- admin panel:  project-roma-admin-panel:rollback-f2-20261024 (1e600758e7fd) == pre-W3
- customer:     project-roma-customer-panel:rollback-f2-20261024 (befd10b7df23) == pre-W3
- node22 cutover: project-roma-backend:rollback-node22-20261024 (835904c79199)

## Stage 1 — host nginx (W1) rollback
State: live config backed up at /etc/nginx/sites-available/balport.bak-f2-20261024-122142
Procedure:
  sudo cp /etc/nginx/sites-available/balport.bak-f2-20261024-122142 /etc/nginx/sites-available/balport
  sudo nginx -t && sudo systemctl reload nginx
Verify: curl https://balportliquors.com/ (200), https://api.balportliquors.com/api/store/status (200)
Snippets added during W1 (cloudflare-realip.conf, proxy-identity-headers.conf) are
harmless if left in place after rollback (the .bak file has no references to them).

## Stage 2 — panel nginx (W3) rollback
Panels are rebuilt from git-tracked nginx.conf in the repo. Rollback:
  git checkout -- customer-panel/nginx.conf admin-panel/nginx.conf
  docker compose --env-file .env.local up -d --build --force-recreate customer-panel admin-panel
Fallback without rebuild (image-based):
  docker tag project-roma-customer-panel:rollback-f2-20261024 project-roma-customer-panel:latest
  docker tag project-roma-admin-panel:rollback-f2-20261024 project-roma-admin-panel:latest
  docker compose --env-file .env.local up -d --force-recreate customer-panel admin-panel

## Stage 3 — backend (W4) rollback
  docker tag project-roma-backend:f6-verified-20261024 project-roma-backend:latest
  docker compose --env-file .env.local up -d --force-recreate backend
Verify: curl 127.0.0.1:5001/api/store/status (200); panels reachable; no CF-Ray anomalies.

## Universal STOP conditions (any stage)
- storefront/API/admin/login health check fails after change
- nginx -t fails (never reload)
- unexpected container restart loop
- false 429s for legitimate customers (rate-limit matrix)