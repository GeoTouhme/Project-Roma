#!/usr/bin/env python3
"""Read-only encrypted-backup inventory. Never decrypts, deletes, uploads or changes archives."""
import argparse, datetime, json, pathlib, re

def report(directory, days=None, now=None):
    if days is not None and days < 1:
        raise ValueError('Retention days must be positive')
    now = now or datetime.datetime.now(datetime.timezone.utc)
    encrypted = plaintext = malformed = older = 0
    for path in directory.iterdir():
        if path.is_symlink() or not path.is_file():
            continue
        if path.name.endswith('.dump.gz'):
            plaintext += 1
        if re.fullmatch(r'\d{8}T\d{6}Z\.dump\.gz\.aesgcm', path.name):
            encrypted += 1
            with path.open('rb') as archive:
                valid = archive.read(8) == b'ROMABK1\x00' and path.stat().st_size >= 36
            malformed += not valid
            try:
                created = datetime.datetime.strptime(path.name[:16], '%Y%m%dT%H%M%SZ').replace(tzinfo=datetime.timezone.utc)
                older += bool(days and (now - created).days >= days)
            except ValueError:
                malformed += 1
    return {'encryptedArchives': encrypted, 'plaintextArchives': plaintext, 'invalidHeaders': malformed,
            'olderThanProposedRetention': older, 'proposedDays': days, 'destructiveCleanupEnabled': False,
            'authenticationAndRestoreVerified': False, 'offsiteRecoveryVerified': False}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', type=pathlib.Path, required=True)
    parser.add_argument('--proposed-days', type=int)
    args = parser.parse_args()
    try:
        print(json.dumps(report(args.directory, args.proposed_days), indent=2))
    except (OSError, ValueError):
        raise SystemExit('Inventory unavailable; check directory access and retention input securely.')
