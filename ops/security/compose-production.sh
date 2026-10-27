#!/bin/sh
set -eu
exec docker compose \
  --project-directory /home/geo/projects/Project-Roma \
  --env-file /etc/project-roma/.env \
  -p project-roma \
  -f /etc/project-roma/compose.yml \
  -f /etc/project-roma/hardened.yml \
  -f /etc/project-roma/images.yml "$@"
