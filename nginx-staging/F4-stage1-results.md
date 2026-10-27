# F4 Stage 1 deployment — 2026-10-24

Stage 1 deployed at **13:18:18 UTC**, following explicit authorization in prompt.txt and operator confirmation of Hostinger console access. No Stage 2 AOP, firewall, Docker, backend, database, SSH, or Plutus changes.

## Exact changes

- Created `/etc/nginx/conf.d/balport-origin-peer.conf`, identical to workspace `f4-origin-peer.conf`: geo lookup against `$realip_remote_addr`, default deny, official 15 IPv4 and 7 IPv6 Cloudflare ranges; diagnostic log format records original peer separately from reconstructed client.
- Added the following after the existing Real IP include in each of the three Balport TLS servers in `/etc/nginx/sites-available/balport` (apex, admin, API). Full deployed file is `f4-balport.conf`.

  ```nginx
  # F4: authorize the original TCP peer, independently of visitor identity.
  if ($balport_cf_peer = 0) { return 403; }
  access_log /var/log/nginx/balport-origin-access.log balport_origin;
  ```

- Ran `nginx -t` before and after install, then `systemctl reload nginx` gracefully. Nginx remains active. All three protected servers now use `/var/log/nginx/balport-origin-access.log`; the existing global access log continues for other servers.
- Re-fetched official ranges immediately before deployment; they matched the preflight lists and active Real IP trust exactly. Rechecked protected-file fingerprints, candidate equality, and rollback availability before writing production files. Isolated realip/geo and complete staged Nginx tests passed during preflight.

## Verification

| Check | Result |
|---|---|
| Public API through Cloudflare | 200 |
| Direct origin apex, www, admin, API | All 403 |
| Same four direct requests with forged CF-Connecting-IP, X-Real-IP, XFF, CF-Ray | All 403 |
| 20 SNI/Host combinations: five SNI names including Plutus × four Balport Hosts | All 403 |
| Direct IP / unknown Host | 403 |
| Public storefront, www, login, admin HTML | Cloudflare challenge 403, matching predeployment baseline; browser validation pending |
| Socket.IO polling, public API and storefront | 200, Engine.IO handshake |
| Actual WebSocket upgrade, API and storefront | 101 Switching Protocols |
| Admin WebSocket, without Basic Auth | 401 from existing authentication |
| Unsigned Stripe webhook POST through public API | Handler reached, 200 per existing behavior; backend logs confirm `Missing stripe-signature header` rejection |
| Genuine signed provider event | Not available; remains unverified |
| DoorDash/Uber Direct | Routes disabled in running backend; no provider integration enabled or changed |
| Plutus HTTPS `/` | 200 |
| Plutus nonexistent HTTP ACME URL | 301, matching baseline |
| Backend loopback status | 200 |
| Origin public IPv6 HTTPS | Connection refused, consistent with no IPv6 Nginx listener |
| SSH, Nginx, certbot.timer | Active; existing SSH connections retained |

Independent external **predeployment** Windows curl was 200, supplied by the operator. The same independent **postdeployment** curl is requested and pending; VPS-origin tests do not replace it. Authenticated login/admin operations and browser storefront usability are likewise pending operator confirmation. No browser session or provider credentials were available to verify those flows directly.

During the first postdeployment log check (13:19 UTC), the dedicated origin log contained five accepted Cloudflare requests (all 200) and 30 rejected non-Cloudflare requests (all 403, matching probes). There were **zero Cloudflare-peer 403s and zero 429/502/503 responses** in that log. Later WebSocket checks returned 101/401 as described above. The Nginx error log was empty at that check. Peer and visitor addresses were distinct and correct in accepted samples. This short observation establishes no observed gate-induced failure; it does not establish that every legitimate flow has been exercised.

Plutus vhost, its Certbot renewal profile, both identity snippets, backend security source files, and Compose fingerprints match their predeployment values. F1/F2/F6-related files and running containers were not changed. Certificate renewal was not invoked because the Nginx authenticator can modify/reload configuration; its configuration and HTTP behavior were preserved.

## Rollback and remaining exposure

Backup: `/root/f4-stage1-20261024T130850Z/nginx-prechange.tar`, current pre-F4 Balport file, and fingerprint manifest in the same directory.

If critical functionality fails:

```bash
sudo bash /root/f4-stage1-20261024T130850Z/rollback.sh
```

The prepared script restores the pre-F4 Balport file, moves the introduced peer map outside the active include directory, validates Nginx, then reloads. No rollback has been required so far. Recheck current state before reusing this script after further authorized changes.

TCP 443 and TLS negotiation remain public; the gate rejects HTTP requests from non-Cloudflare peers. The allowlist identifies the Cloudflare network, not this account/zone. AOP is not deployed. Plutus retains intentional direct HTTPS access; unrelated public Docker service exposure remains outside Stage 1. Port 80 and renewal behavior are unchanged. Maintain Cloudflare CIDRs alongside Real IP trust.

Stopped before Stage 2. Awaiting operator review and the pending external/browser results.
