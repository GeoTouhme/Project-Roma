# F4 Stage 1 preflight — 2026-10-24 13:09 UTC

Historical preflight record. Stage 1 was subsequently deployed at 2026-10-24 13:18:18 UTC; see `F4-stage1-results.md` for current status.

- Official Cloudflare lists downloaded over verified HTTPS: 15 IPv4 and 7 IPv6 ranges, exactly matching live Real IP trust.
- Effective `nginx -T` reviewed; complete candidate passes `nginx -t -c /tmp/f4-stage1/full-nginx.conf`.
- Isolated Nginx test passed: trusted simulated edge retained original peer while rewriting visitor; an unallowed peer forging a Cloudflare visitor address received 403. Initial fixture failed because its default log path was not writable; corrected to a test-local log and rerun successfully.
- Proposed files: `f4-origin-peer.conf` → `/etc/nginx/conf.d/balport-origin-peer.conf`; `f4-balport.conf` → `/etc/nginx/sites-available/balport`. Changes are the original-peer geo table, diagnostic log format, and server-level return-only gates in three existing Balport TLS servers. No AOP changes.
- Complete active Nginx tree backup: `/root/f4-stage1-20261024T130850Z/nginx-prechange.tar`.
- Current Balport backup and prepared executable rollback: `/root/f4-stage1-20261024T130850Z/balport` and `/root/f4-stage1-20261024T130850Z/rollback.sh`. The rollback is for use only after this candidate is installed; recheck paths/current state first.
- F1/F2/F6-related backend, Compose, and identity-snippet fingerprints unchanged. Existing workspace modifications preserved.
- Working SSH confirmed through inherited SSH_CONNECTION, established sshd connections, active SSH service, and port 22 listeners. Separate Hostinger console/recovery access requires operator confirmation.
- External test via existing identity to `geo@100.93.241.73` failed strict host-key verification: no trusted key. No host key was accepted and SSH settings were not changed.
- Plutus TLS vhost, renewal profile, and identity snippets unchanged by hashes. Plutus HTTPS `/` returns 200; HTTP nonexistent ACME URL returns 301 as before. Certbot timer active. Renewal was not invoked because its Nginx plugin can modify/reload configuration.
- Before deployment, public storefront/www/admin/login curl requests receive Cloudflare 403 with `cf-mitigated: challenge`; public API status returns 200. Direct-origin storefront/login return 200. These edge challenges must be distinguished from origin-gate failures during verification.

Outstanding prerequisites: operator recovery-access confirmation and a trusted independent external testing path. Awaiting response to the in-session question. Authenticated browser/admin and genuine provider webhook validation also need an available authenticated session/provider test facility; do not claim them from an unauthenticated curl response. Deployment and postdeployment acceptance matrix remain pending. Stage 2 is not authorized.
