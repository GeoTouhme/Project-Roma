# MAINTENANCE TASK (HIGH PRIORITY) — roma-backup.service broken

Recorded: 2026-10-29 (during pricing-fix deployment; explicitly excluded from that deployment's scope per owner instruction)

## Problem
`sudo systemctl start roma-backup.service` fails:

```
python3[997063]: Database backup failed; inspect credentials and service health securely
```

## Root cause
`/usr/local/libexec/roma-security/backup-db.py` runs:

```
docker exec --user 0 balport-mongo mongodump --config /run/secrets/mongo-backup.yml ...
```

but the container has NO Docker secret mounted at `/run/secrets/mongo-backup.yml` —
the file lives on the HOST at `/etc/project-roma/mongo-backup.yml` and is not
bind-mounted into `balport-mongo`. The timer (`roma-backup.timer`, daily 03:20 UTC)
has therefore been failing since the hardened compose cutover. Last known-good
encrypted archive: `20261029T032006Z.dump.gz.aesgcm` (produced while the secret
mount still worked).

## Consequence
- Daily encrypted backups are NOT being produced.
- Off-host retention still unconfigured (pre-existing).

## Workaround verified working (2026-10-29)
```
sudo docker cp /etc/project-roma/mongo-backup.yml balport-mongo:/tmp/mongo-backup.yml
sudo docker exec --user 0 balport-mongo mongodump --config /tmp/mongo-backup.yml --db liquor_shop --archive --gzip --quiet > /tmp/<name>.dump
sudo docker exec balport-mongo sh -c 'rm -f /tmp/mongo-backup.yml'
```
(Backup taken this way 2026-10-29: `/tmp/liquor_shop-backup-before-pricing-fix.dump`,
restore-verified into a throwaway Mongo — 24,802 docs, 0 failures.)

## Proper fix (proposed, NOT yet applied)
Bind-mount the backup config read-only into the mongo service in
`/etc/project-roma/compose.yml` (and `docker-compose.yml` for parity):

```yaml
mongodb:
  volumes:
    - /etc/project-roma/mongo-backup.yml:/run/secrets/mongo-backup.yml:ro
```

then `sudo roma-compose up -d --no-build --pull never mongodb` and run
`sudo systemctl start roma-backup.service` to confirm exit 0 and a new
`.dump.gz.aesgcm` under `/var/backups/project-roma/`.

Note: `hardened.yml` uses `read_only` on the container rootfs — the mount target
path must be an explicit volume mount (write access not needed; mongodump only reads).