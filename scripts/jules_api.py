#!/usr/bin/env python3
"""Jules API helper — reads keys from jules.keys.json, routes local/remote."""
import json, sys, subprocess, os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
KEYS_FILE = os.environ.get("JULES_KEYS_FILE", os.path.join(SCRIPT_DIR, "jules.keys.json"))
API_BASE = "https://jules.googleapis.com/v1alpha"
LOCAL_BASE = os.environ.get("JULES_LOCAL_URL", "http://localhost:8080")


def load_key(acct_type: str) -> str:
    if not os.path.isfile(KEYS_FILE):
        return ""
    with open(KEYS_FILE) as f:
        data = json.load(f)
    for acc in data.get("accounts", []):
        if acc.get("type") == acct_type and acc.get("current"):
            return acc.get("apiKey", "")
    return ""


def jules_remote(method: str, endpoint: str, body: str = "") -> str:
    key = load_key("remote")
    url = f"{API_BASE}{endpoint}"
    # Build the remote curl command as a single string for SSH
    remote_cmd = f"curl -s -X {method} -H 'x-goog-api-key: {key}' -H 'Content-Type: application/json'"
    if body:
        escaped = body.replace("'", "'\\''")
        remote_cmd += f" -d '{escaped}'"
    remote_cmd += f" '{url}'"
    r = subprocess.run(
        ["ssh", "-o", "ConnectTimeout=10", "vpn2", remote_cmd],
        capture_output=True, text=True, timeout=30,
    )
    return r.stdout


def jules_local(method: str, endpoint: str, body: str = "") -> str:
    key = load_key("local")
    url = f"{LOCAL_BASE}{endpoint}"
    cmd = ["curl", "-s", "-X", method,
           "-H", "Content-Type: application/json"]
    if key:
        cmd += ["-H", f"x-goog-api-key: {key}"]
    if body:
        cmd += ["-d", body]
    cmd.append(url)
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    return r.stdout


def main():
    args = sys.argv[1:]
    if len(args) < 3:
        print("Usage: jules_api.py <local|remote> <METHOD> <endpoint> [body]", file=sys.stderr)
        sys.exit(1)

    route, method, endpoint = args[0], args[1], args[2]
    body = args[3] if len(args) > 3 else ""

    if route == "local":
        print(jules_local(method, endpoint, body), end="")
    else:
        print(jules_remote(method, endpoint, body), end="")


if __name__ == "__main__":
    main()
