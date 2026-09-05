#!/usr/bin/env python3
"""Historical sing-box diagnostic; production uses prepare-xhttp.py and Xray.

Probe current subscription nodes without changing the shared VPN.

Run only on Selectel. Credentials remain in memory until an explicitly requested
new mode-0600 config is written. Existing files are never replaced.
"""
import argparse
import base64
import json
import os
from pathlib import Path
import socket
import subprocess
import time
import urllib.parse
import urllib.request
import uuid

HEALTH_URL = "https://smotri-na-nebo.vektordaniil1.chatgpt.site/api/health"
PORT = 1087


def config(nodes):
    return {
        "log": {"level": "error"},
        "dns": {"servers": [{"type": "local", "tag": "local"}], "final": "local"},
        "inbounds": [{"type": "socks", "listen": "127.0.0.1", "listen_port": PORT}],
        "outbounds": nodes + [{
            "type": "urltest", "tag": "astro-auto",
            "outbounds": [n["tag"] for n in nodes],
            "url": HEALTH_URL, "interval": "5m", "tolerance": 100,
        }],
        "route": {"final": "astro-auto", "default_domain_resolver": "local"},
    }


def subscription_nodes(servers):
    url = Path("/etc/shadowlos/subscription.url").read_text().strip()
    if urllib.parse.urlsplit(url).scheme != "https":
        raise ValueError("Subscription must use HTTPS")
    request = urllib.request.Request(url, headers={"User-Agent": "sing-box/1.13.18"})
    with urllib.request.urlopen(request, timeout=20) as response:
        raw = response.read(2_000_001)
    if len(raw) > 2_000_000:
        raise ValueError("Subscription too large")
    nodes = []
    for line in raw.decode().splitlines():
        uri = urllib.parse.urlsplit(line)
        if uri.scheme not in ("vless", "ss") or uri.hostname not in servers:
            continue
        query = urllib.parse.parse_qs(uri.query, keep_blank_values=True)
        q = lambda key, default="": query.get(key, [default])[0]
        if uri.scheme == "ss":
            if q("plugin"):
                continue
            if uri.password is not None:
                method, password = urllib.parse.unquote(uri.username), urllib.parse.unquote(uri.password)
            else:
                encoded = urllib.parse.unquote(uri.username)
                method, password = base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)).decode().split(":", 1)
            nodes.append({"type": "shadowsocks", "tag": f"astro-{len(nodes) + 1}",
                          "server": uri.hostname, "server_port": uri.port,
                          "method": method, "password": password})
            continue
        if q("type") != "tcp" or q("security") != "reality":
            continue
        if q("flow") not in ("", "xtls-rprx-vision") or not q("pbk") or not q("sni"):
            continue
        tls = {
            "enabled": True, "server_name": q("sni"),
            "utls": {"enabled": True, "fingerprint": q("fp", "chrome")},
            "reality": {"enabled": True, "public_key": q("pbk"), "short_id": q("sid")},
        }
        if q("alpn"):
            tls["alpn"] = q("alpn").split(",")
        nodes.append({
            "type": "vless", "tag": f"astro-{len(nodes) + 1}",
            "server": uri.hostname, "server_port": uri.port,
            "uuid": str(uuid.UUID(uri.username)), "flow": q("flow"), "tls": tls,
        })
    if not nodes:
        raise ValueError("No supported nodes for the selected servers")
    return nodes


def probe(node):
    encoded = json.dumps(config([node])).encode()
    check = subprocess.run(["/usr/bin/sing-box", "check", "-c", "/dev/stdin"],
                           input=encoded, capture_output=True)
    if check.returncode:
        raise ValueError("Generated proxy config failed validation")
    with socket.socket() as guard:
        guard.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        guard.bind(("127.0.0.1", PORT))
    process = subprocess.Popen(["/usr/bin/sing-box", "run", "-c", "/dev/stdin"],
                               stdin=subprocess.PIPE, stdout=subprocess.DEVNULL,
                               stderr=subprocess.PIPE)
    try:
        process.stdin.write(encoded)
        process.stdin.close()
        for _ in range(50):
            if process.poll() is not None:
                return False
            try:
                with socket.create_connection(("127.0.0.1", PORT), timeout=.1):
                    break
            except OSError:
                time.sleep(.1)
        result = subprocess.run([
            "/usr/bin/curl", "--fail", "--silent", "--show-error", "--max-time", "20",
            "--proxy", f"socks5h://127.0.0.1:{PORT}", HEALTH_URL,
        ], capture_output=True)
        if result.returncode:
            print("Probe HTTP request failed, curl exit", result.returncode, flush=True)
            return False
        body = json.loads(result.stdout)
        return body.get("ok") is True and body.get("app") == "smotri-na-nebo"
    finally:
        process.terminate()
        process.wait(timeout=5)
        diagnostics = process.stderr.read().decode(errors="replace")[-1200:]
        reality = node.get("tls", {}).get("reality", {})
        for value in (node.get("uuid"), node.get("password"),
                      reality.get("public_key"), reality.get("short_id")):
            if value:
                diagnostics = diagnostics.replace(value, "[redacted]")
        if diagnostics.strip():
            print(diagnostics.strip(), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--server", action="append", required=True,
                        help="Explicitly selected server IP/hostname from the subscription")
    parser.add_argument("--output", type=Path, help="Create a new secret config after successful probes")
    args = parser.parse_args()
    if args.output and (args.output.exists() or args.output.is_symlink()):
        raise ValueError("Output already exists; preserve it and choose a new versioned path")
    working = []
    for node in subscription_nodes(set(args.server)):
        ok = probe(node)
        print(node["server"], "app reachable" if ok else "app unreachable", flush=True)
        if ok:
            working.append(node)
    if not working:
        raise ValueError("No working route; nothing installed")
    if args.output:
        fd = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, "w") as output:
            json.dump(config(working), output, indent=2)
            output.write("\n")
        print("Created private config with", len(working), "verified routes")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # Network exceptions can contain the private subscription URL.
        raise SystemExit(f"Proxy preparation failed ({type(error).__name__}); no credentials logged")
