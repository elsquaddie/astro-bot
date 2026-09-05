#!/usr/bin/env python3
"""Probe Kazakhstan XHTTP from the server's subscription; optionally save a NEW config."""
import argparse
import json
import os
from pathlib import Path
import socket
import subprocess
import time
import urllib.parse
import urllib.request
import uuid

BINARY = "/opt/astro-reminders/bin/xray-v26.3.27"
HEALTH_URL = "https://smotri-na-nebo.vektordaniil1.chatgpt.site/api/health"


def configuration():
    url = Path("/etc/shadowlos/subscription.url").read_text().strip()
    if urllib.parse.urlsplit(url).scheme != "https":
        raise ValueError("Subscription must use HTTPS")
    with urllib.request.urlopen(url, timeout=20) as response:
        raw = response.read(2_000_001)
    if len(raw) > 2_000_000:
        raise ValueError("Subscription too large")
    for line in raw.decode().splitlines():
        uri = urllib.parse.urlsplit(line)
        if uri.scheme != "vless" or uri.hostname != "198.13.188.135":
            continue
        query = urllib.parse.parse_qs(uri.query, keep_blank_values=True)
        q = lambda key, default="": query.get(key, [default])[0]
        if q("type") != "xhttp" or q("security") != "reality" or q("encryption") != "none":
            continue
        return {
            "log": {"loglevel": "error"},
            "inbounds": [{"listen": "127.0.0.1", "port": 1087, "protocol": "socks",
                          "settings": {"auth": "noauth", "udp": False}}],
            "outbounds": [{
                "protocol": "vless",
                "settings": {"vnext": [{"address": uri.hostname, "port": uri.port,
                    "users": [{"id": str(uuid.UUID(uri.username)), "encryption": "none"}]}]},
                "streamSettings": {
                    "network": "xhttp", "security": "reality",
                    "realitySettings": {"serverName": q("sni"), "fingerprint": q("fp", "chrome"),
                                        "password": q("pbk"), "shortId": q("sid")},
                    "xhttpSettings": {"path": q("path", "/"), "mode": "auto"},
                },
            }],
        }
    raise ValueError("Kazakhstan XHTTP node missing or changed")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.output and (args.output.exists() or args.output.is_symlink()):
        raise ValueError("Output exists; use a new versioned path")
    encoded = json.dumps(configuration()).encode()
    result = subprocess.run([BINARY, "run", "-test", "-config", "stdin:"],
                            input=encoded, capture_output=True, timeout=10)
    if result.returncode:
        raise ValueError("Config validation failed")
    with socket.socket() as guard:
        guard.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        guard.bind(("127.0.0.1", 1087))
    process = subprocess.Popen([BINARY, "run", "-config", "stdin:"], stdin=subprocess.PIPE,
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        process.stdin.write(encoded)
        process.stdin.close()
        for _ in range(50):
            if process.poll() is not None:
                raise ValueError("Proxy stopped")
            try:
                with socket.create_connection(("127.0.0.1", 1087), timeout=.1):
                    break
            except OSError:
                time.sleep(.1)
        result = subprocess.run([
            "/usr/bin/curl", "--fail", "--silent", "--show-error", "--max-time", "30",
            "--proxy", "socks5h://127.0.0.1:1087", HEALTH_URL,
        ], capture_output=True, timeout=35)
        print("Kazakhstan probe curl exit", result.returncode, flush=True)
        if result.returncode:
            raise ValueError("Health request failed")
        body = json.loads(result.stdout)
        if body.get("ok") is not True or body.get("app") != "smotri-na-nebo":
            raise ValueError("Unexpected health response")
        print("Kazakhstan: app reachable", flush=True)
    finally:
        process.terminate()
        process.wait(timeout=5)
    if args.output:
        fd = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, "wb") as output:
            output.write(encoded + b"\n")
        print("Created private verified XHTTP config")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # Never print an exception that could contain subscription credentials.
        raise SystemExit(f"XHTTP preparation failed ({type(error).__name__})")
