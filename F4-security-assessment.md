# F4 independent assessment — 2026-10-24

Read-only audit. No production configuration, firewall, dashboard, container, or service changes were made. Proposed commands below require authorization.

## Assessment

**F4 remains open (high risk): the application can be reached without Cloudflare's WAF.** On host `srv1895412`, public IPv4 is `2.24.104.25`; the old audit's `31.97.132.106` is stale. `nginx -T` passed and shows Real IP and sanitized identity snippets active in all three Balport TLS vhosts, but no peer allowlist or client certificate enforcement. UFW is active and permits 443 from anywhere in both address families. Nginx currently listens on IPv4 only for 80/443, despite the host having public IPv6.

GET `/api/store/status` with SNI/Host forced to the origin returned storefront 200, API 200, admin 401, and www 200. Curl's connected peer was `2.24.104.25`. These probes originated on the VPS: they prove the running vhost serves a direct non-Cloudflare connection, but are not an independent external reachability test or proof about a provider firewall. Public API through Cloudflare returned 200. Apex, www, admin, and API DNS resolve to Cloudflare addresses.

Real IP changes `$remote_addr` to the visitor address. Ordinary Nginx `allow <Cloudflare CIDR>; deny all;` checks that rewritten address and can reject genuine visitors. Use **`$realip_remote_addr` for origin peer authorization**, retaining `$remote_addr` for visitor identity. Header presence (`CF-Ray`, `CF-Connecting-IP`, XFF) cannot authenticate a connection. [Nginx Real IP documentation](https://nginx.org/en/docs/http/ngx_http_realip_module.html).

Observed existing protections to preserve:

- F1: running Balport backend, panels, MongoDB, and image service publish only on loopback; backend remains `127.0.0.1:5001`.
- F2: live host snippets rebuild X-Real-IP/XFF and strip CF-Connecting-IP. Running backend index/client-IP source hashes match the local reviewed files. Do not replace these with older staged backups or alter proxy trust as part of F4.
- F6: current history includes `30b43aa`, removing forged-cookie rate-limit bypass. F4 requires no backend code, dependency, image, or limiter changes.

Other service dependency: `plutus.balportliquors.com` is DNS-only at this origin and has its own TLS vhost and Let's Encrypt renewal using the Nginx authenticator. A host-wide Cloudflare-only 443 firewall would break it. There is no active invoices vhost in `nginx -T`. Several unrelated Docker services publish publicly, including Plutus MongoDB on 27018; Docker forwarding rules can bypass UFW input restrictions. This is a separate exposure requiring review, not permission to modify those services.

## Options and recommendation

| Control | Benefit | Limit / dependency |
|---|---|---|
| Peer IP allowlist in Balport vhosts | Closes ordinary direct origin requests immediately; no dashboard credential needed | Maintain IPv4/IPv6 ranges; permits Cloudflare network, not exclusively this zone; TLS remains publicly reachable |
| Authenticated Origin Pulls (AOP) | Requires a verified client certificate on HTTPS | Needs Cloudflare setting and origin trust certificate; global AOP proves Cloudflare network membership, not zone ownership |
| Combined | Independent network-source and certificate checks | Recommended target; custom zone AOP provides stronger tenant isolation |

Deploy the per-vhost peer gate first. Add AOP in a separate verified step. Prefer a dedicated custom zone AOP certificate/CA if account capabilities and certificate management are available; otherwise global AOP is useful defense in depth, with its shared-certificate limitation explicitly accepted. Neither a Cloudflare Origin CA **server** certificate nor Full (strict) authenticates the incoming client. [Global AOP](https://developers.cloudflare.com/ssl/origin-configuration/authenticated-origin-pull/set-up/global/), [custom zone AOP](https://developers.cloudflare.com/ssl/origin-configuration/authenticated-origin-pull/set-up/zone-level/).

Defer firewall restriction until Plutus and every other legitimate direct HTTPS consumer have an agreed migration. Do not change UFW, Docker chains, SSH, or Tailscale during this deployment.

## Exact proposed Nginx changes

Create `/etc/nginx/conf.d/balport-origin-peer.conf` (loaded in existing `http` context):

```nginx
geo $realip_remote_addr $balport_cf_peer {
    default 0;
    173.245.48.0/20 1;
    103.21.244.0/22 1;
    103.22.200.0/22 1;
    103.31.4.0/22 1;
    141.101.64.0/18 1;
    108.162.192.0/18 1;
    190.93.240.0/20 1;
    188.114.96.0/20 1;
    197.234.240.0/22 1;
    198.41.128.0/17 1;
    162.158.0.0/15 1;
    104.16.0.0/13 1;
    104.24.0.0/14 1;
    172.64.0.0/13 1;
    131.0.72.0/22 1;
    2400:cb00::/32 1;
    2606:4700::/32 1;
    2803:f800::/32 1;
    2405:b500::/32 1;
    2405:8100::/32 1;
    2a06:98c0::/29 1;
    2c0f:f248::/32 1;
}
log_format balport_origin 'peer=$realip_remote_addr client=$remote_addr '
                         'sni=$ssl_server_name host=$host status=$status '
                         'cf_peer=$balport_cf_peer mtls=$ssl_client_verify';
```

Ranges checked against the official [IPv4](https://www.cloudflare.com/ips-v4/) and [IPv6](https://www.cloudflare.com/ips-v6/) lists during this audit. Before deployment revalidate both; update this gate and existing Real IP ranges together, retaining the last known good lists if downloads fail or are empty.

Add these lines at **server scope to each of the three Balport `listen 443 ssl` servers** in `/etc/nginx/sites-available/balport`, immediately after the existing Real IP include:

```nginx
if ($balport_cf_peer = 0) { return 403; }
access_log /var/log/nginx/balport-origin-access.log balport_origin;
```

A return-only `if` avoids access-phase inheritance and location exception problems. Do not add loopback, private-subnet, monitoring, or webhook exemptions. Local health checks should use backend loopback endpoints, and end-to-end monitors should use public proxied hostnames. Existing server-level logging is replaced for these vhosts by this dedicated log; update any log consumer accordingly.

The apex is currently the default TLS server, and www falls through to it. Its gate therefore also protects those fallback requests. Preserve this default ordering. Before AOP, test mixed SNI/Host requests against Plutus; the HTTP gate must still reject requests whose Host selects a protected Balport server. An explicit www TLS server or default reject server can be a separate hostname-hardening change after deciding expected www behavior.

For AOP, place the chosen **client trust CA** at `/etc/nginx/snippets/balport-aop-ca.pem`; this is distinct from the existing server certificate. Add only to the same Balport TLS servers:

```nginx
ssl_client_certificate /etc/nginx/snippets/balport-aop-ca.pem;
ssl_verify_client optional;  # observation stage only
ssl_verify_depth 2;
```

After enabling the matching AOP mode in Cloudflare and observing `mtls=SUCCESS` for fresh proxied requests to every hostname, change `optional` to `on`. Optional alone is not remediation. Validate missing/invalid client certificates and mixed SNI/Host routing; the peer gate remains required. Do not apply AOP globally to Plutus.

## Legitimate traffic and dashboard dependencies

- **Stripe:** remains public HTTPS → Cloudflare → origin. Stripe does not need the AOP key; Cloudflare supplies the origin client certificate. Keep existing raw-body/signature handling. Current handler returns 200 even on invalid signatures, so 200 alone is insufficient evidence: verify a genuine provider test event and application handling. Do not replay a real payment event without considering duplicate effects.
- **DoorDash / Uber Eats:** this repository implements DoorDash Drive and Uber Direct; both routes are disabled in the running backend. No active Uber Eats Marketplace webhook configuration was established. Inventory actual provider portal URLs before deployment; migrate any direct-IP/DNS-only endpoints to protected HTTPS hostnames. Do not enable dormant routes as part of F4. DoorDash's comment about portal Basic Auth is not evidence of origin-side verification.
- **Cloudflare rules:** confirm all required records are proxied, Full (strict) is selected, and Workers, Origin Rules, Load Balancers, Access policies, and health checks do not introduce unexpected origin paths. Dashboard settings/credentials were not available for inspection; public DNS does not prove them. Confirm webhook POST paths are uncached and unchallenged, with narrowly scoped exceptions only as needed. Free Bot Fight Mode cannot be skipped by WAF custom rules; disable it if it disrupts these requests or use a product supporting exceptions. The older audit's skip recommendation is incorrect. [Cloudflare limitation](https://developers.cloudflare.com/bots/get-started/bot-fight-mode/#limitations).
- **Certificate renewal:** active Balport certificate is Cloudflare Origin CA, valid Aug 2026–Aug 2041; it is not Let's Encrypt. Plutus alone has a Certbot renewal profile. Leave port 80 and existing ACME handling untouched. Do not grey-cloud Balport to renew certificates; strict origin gates and an Origin CA certificate make that unsuitable. Future ACME use can use DNS-01 with a narrowly scoped DNS token. Do not run Certbot renew/dry-run in this read-only audit: the Nginx plugin can modify/reload configuration.
- **Monitoring / other consumers:** inventory direct-IP checks, cron jobs, partner callbacks, www redirects, Socket.IO, and Plutus before enforcement. Move origin diagnostics to backend loopback, or a separately designed private management endpoint. No generic allowlist exception for providers.
- **Credentials:** the peer gate requires none. AOP needs dashboard permission to enable the selected mode; custom zone AOP also needs secure certificate/key provisioning and upload permission (zone ID and scoped API token if using API). No dashboard/API credential readiness or custom-AOP entitlement was established here. Install only the public trust CA on Nginx; keep CA signing keys offline.

## Deployment sequence and rollback — proposed only

1. Obtain authorization, confirm dashboard/provider dependencies, record health baselines, and arrange external IPv4/IPv6 testing. Keep an SSH/Tailscale session and console recovery available.
2. Back up the **current F2-preserving configuration**, not an older pre-F2 backup:

   ```bash
   sudo install -d -m 700 /root/f4-prechange
   sudo cp -a /etc/nginx/sites-available/balport /root/f4-prechange/balport
   sudo cp -a /etc/nginx/snippets/cloudflare-realip.conf /root/f4-prechange/cloudflare-realip.conf
   sudo cp -a /etc/nginx/snippets/proxy-identity-headers.conf /root/f4-prechange/proxy-identity-headers.conf
   ```

   Use a fresh backup directory if it already exists. Confirm the proposed peer config path is absent before creating it; otherwise back it up too.
3. Install the peer map and add the three gates/log directives. Run `sudo nginx -t`; stop on failure. Then, only after authorization, `sudo systemctl reload nginx`. No restart or container rebuild.
4. Run the acceptance matrix below. Roll back immediately for storefront/API/admin failures, incorrect client identities, new false 429s, webhook failures, or Plutus regression.
5. Install the selected AOP CA and optional verification; validate/reload. Enable Cloudflare AOP, confirm fresh connections report SUCCESS, then enforce `on`, validate/reload, and repeat acceptance. Keep the peer gate throughout.
6. Observe errors, provider delivery status, and origin logs through a normal operating period. Schedule CIDR review and AOP certificate renewal/rotation monitoring. Firewall migration is a separate deployment after Plutus is addressed.

Acceptance checks (future deployment):

```bash
# Public API: 200; storefront /: 200; admin /: existing 401 without credentials.
curl -sS -o /dev/null -w '%{http_code}\n' https://api.balportliquors.com/api/store/status
curl -sS -o /dev/null -w '%{http_code}\n' https://balportliquors.com/
curl -sS -o /dev/null -w '%{http_code}\n' https://admin.balportliquors.com/

# Run externally too. Peer-gate stage: 403. With AOP: TLS/client-cert rejection
# or Nginx certificate error is also acceptable; application 2xx is never acceptable.
curl -ksS --resolve api.balportliquors.com:443:2.24.104.25 https://api.balportliquors.com/api/store/status
curl -ksS --resolve api.balportliquors.com:443:2.24.104.25 -H 'CF-Connecting-IP: 173.245.48.1' -H 'X-Real-IP: 173.245.48.1' -H 'X-Forwarded-For: 173.245.48.1' -H 'CF-Ray: forged' https://api.balportliquors.com/api/store/status

# Mixed SNI/Host must not expose the API through the unprotected Plutus server.
curl -ksS --resolve plutus.balportliquors.com:443:2.24.104.25 -H 'Host: api.balportliquors.com' https://plutus.balportliquors.com/api/store/status

# Local backend diagnostic remains available.
curl -sS http://127.0.0.1:5001/api/store/status
```

Repeat direct tests for apex/admin/www, unknown Host, no SNI, and every public address. External IPv6 to `[2a02:4780:75:2146::1]` currently should not connect to Nginx; if an IPv6 listener is introduced, require equivalent denial. Verify legitimate proxied requests log a Cloudflare `peer`, actual visitor `client`, and AOP SUCCESS when enforced. Check storefront login/cart, authenticated admin, Socket.IO, image loading, and controlled provider test delivery. Confirm existing F2 spoof tests and F6 forged-cookie rate-limit matrix retain their expected behavior without load testing production. Confirm Plutus baseline and HTTP-01 availability remain unchanged.

Rollback commands (only if the files were introduced by this deployment):

```bash
sudo cp -a /root/f4-prechange/balport /etc/nginx/sites-available/balport
sudo mv /etc/nginx/conf.d/balport-origin-peer.conf /root/f4-prechange/balport-origin-peer.disabled
sudo nginx -t && sudo systemctl reload nginx
```

Restore any pre-existing peer config instead of moving it away. For AOP-only rollback, revert `ssl_verify_client on` to `optional` first and validate/reload, retaining the peer gate; disable Cloudflare AOP afterward if required. For full rollback, restore the saved vhost before disabling AOP. Unreferenced CA files can remain. Do not restore the old `balport.bak-f2-*` file, retag/recreate containers, reset Git, flush iptables, or disable UFW: those would risk F1/F2/F6 or unrelated services.
