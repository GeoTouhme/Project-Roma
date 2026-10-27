#!/usr/bin/env python3
"""Host-only encrypted Mongo backup. Retains encrypted archives until off-host retention is configured."""
from pathlib import Path
import datetime, os, shutil, subprocess
os.umask(0o077)
directory=Path('/var/backups/project-roma');directory.mkdir(mode=0o700,parents=True,exist_ok=True);directory.chmod(0o700)
if shutil.disk_usage(directory).free < 1024**3:raise SystemExit('Backup skipped: less than 1 GiB free; existing backups retained')
stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
archive=directory/(stamp+'.dump.gz')
with archive.open('xb') as output:
    result=subprocess.run(['docker','exec','--user','0','balport-mongo','mongodump','--config','/run/secrets/mongo-backup.yml','--db','liquor_shop','--archive','--gzip','--quiet'],stdout=output,stderr=subprocess.PIPE)
if result.returncode:raise SystemExit('Database backup failed; inspect credentials and service health securely')
encrypted=directory/(stamp+'.dump.gz.aesgcm')
subprocess.run(['/usr/bin/python3','/usr/local/libexec/roma-security/encrypt-backup.py',str(archive),'--key-file','/etc/project-roma/backup-encryption.key','--output',str(encrypted)],check=True)
archive.unlink()  # Only this run's plaintext is removed, after authenticated verification.
print('Encrypted local backup completed: '+encrypted.name)
