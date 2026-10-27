# W3 — Panel nginx identity passthrough (F2 final hop).
# Apply to BOTH customer-panel/nginx.conf and admin-panel/nginx.conf.
# Panel rebuild required after editing.

# 1) Trust the host nginx realip boundary so $remote_addr is the validated
#    client (host nginx reaches panels via 127.0.0.1 published ports; the
#    in-container peer is the bridge gateway 172.18.0.1):
set_real_ip_from 172.18.0.1;
set_real_ip_from 127.0.0.1;
real_ip_header X-Real-IP;

# 2) Forward ONLY the validated identity to the backend — overwrite both
#    headers in every proxied location (/, /api/, /socket.io/, /sitemap.xml):
#      proxy_set_header X-Real-IP $remote_addr;
#      proxy_set_header X-Forwarded-For $remote_addr;
#    and REMOVE the existing `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`
#    lines (they would re-admit client chains).
# 3) Strip CF-Connecting-IP for defense in depth:
#      proxy_set_header CF-Connecting-IP "";
#
# After this, the backend's W4 getClientIp sees:
#   peer = 172.18.0.3/.4 (trusted, exact IP)
#   X-Real-IP = validated real client
# and rate limiting / orders / analytics all use one verified identity.