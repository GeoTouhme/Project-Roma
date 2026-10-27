#!/usr/bin/env python3
"""Host-only aggregate monitoring. No raw logs, credentials, customer data or external exports."""
import json, subprocess, urllib.request, datetime
names = ['balport-backend','balport-customer-panel','balport-admin-panel','balport-mongo','balport-image-fallback']
result = subprocess.run(['docker','inspect','--format','{{.Name}} {{.State.Running}}',*names],capture_output=True,text=True)
status = {}
for line in result.stdout.splitlines():
    name,running=line.split(); status[name.lstrip('/')]=running=='true'
try:
    with urllib.request.urlopen('http://127.0.0.1:5001/api/store/status',timeout=5) as response: api=response.status==200
except Exception: api=False
print(json.dumps({'time':datetime.datetime.now(datetime.timezone.utc).isoformat(),'containers':status,'apiHealthy':api}))
raise SystemExit(0 if api and len(status)==len(names) and all(status.values()) else 1)
