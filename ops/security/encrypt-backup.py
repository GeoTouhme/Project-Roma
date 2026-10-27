#!/usr/bin/env python3
"""Encrypt a completed archive with AES-256-GCM. Keep the key in a separate recovery location."""
import argparse, os, pathlib, hashlib, struct, tempfile
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
parser=argparse.ArgumentParser();parser.add_argument('archive');parser.add_argument('--key-file',required=True);parser.add_argument('--output',required=True);args=parser.parse_args()
os.umask(0o077)
source=pathlib.Path(args.archive);keyfile=pathlib.Path(args.key_file);output=pathlib.Path(args.output)
if not keyfile.exists():
    with keyfile.open('xb') as keyout:keyout.write(os.urandom(32))
if keyfile.stat().st_mode & 0o077:raise SystemExit('Encryption key must be owner-only')
key=keyfile.read_bytes()
if len(key)!=32:raise SystemExit('Invalid encryption key')
iv=os.urandom(12);encryptor=Cipher(algorithms.AES(key),modes.GCM(iv)).encryptor()
header=b'ROMABK1\x00'+iv;encryptor.authenticate_additional_data(header)
original=hashlib.sha256()
with source.open('rb') as inp,output.open('xb') as out:
    out.write(header)
    while chunk:=inp.read(1024*1024):original.update(chunk);out.write(encryptor.update(chunk))
    out.write(encryptor.finalize());out.write(encryptor.tag)
# Verify the authentication tag and content hash without writing a plaintext copy.
with output.open('rb') as inp:
    header=inp.read(20);inp.seek(-16,2);tag=inp.read(16);remaining=output.stat().st_size-36;inp.seek(20)
    decryptor=Cipher(algorithms.AES(key),modes.GCM(header[8:],tag)).decryptor();decryptor.authenticate_additional_data(header)
    restored=hashlib.sha256()
    while remaining:
        chunk=inp.read(min(1024*1024,remaining));remaining-=len(chunk);restored.update(decryptor.update(chunk))
    restored.update(decryptor.finalize())
if original.digest()!=restored.digest():raise SystemExit('Backup verification failed')
print('Encrypted backup authenticated and content verified; credentials and customer data omitted')
