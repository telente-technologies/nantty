"""HAProxy supervisor: Secrets Manager certificate polling and graceful reload.

All remote listeners are TLS. Raw application ports have no SG ingress. Local
client listeners bind only 127.0.0.1 and use verified mTLS to remote task proxies.
"""
import hashlib
import http.client
import json
import logging
import os
from pathlib import Path
import signal
import socket
import ssl
import subprocess
import sys
import time

import boto3
from cryptography import x509
from cryptography.hazmat.primitives import serialization

STATE = Path(os.environ.get("TLS_STATE_DIR", "/run/tls"))


def config_text(config):
    pem, ca = STATE / "identity.pem", STATE / "ca.pem"
    lines = ["global", "  log stdout format raw local0", "  maxconn 2048", "  hard-stop-after 1h",
             "defaults", "  log global", "  mode tcp", "  timeout connect 5s", "  timeout client 1h",
             "  timeout server 1h", "  timeout check 3s", "  timeout tunnel 1h",
             "resolvers vpc", "  parse-resolv-conf", "  resolve_retries 3", "  timeout resolve 1s",
             "  timeout retry 1s", "  hold valid 10s", "  accepted_payload_size 8192"]
    clients = " ".join(sorted(set(config["clients"] + [config["identity"]])))
    for label, port, mutual in [("alb", 18443, False), ("mesh", 19443, True)]:
        # An ALB does not present client certificates. Its dedicated encrypted
        # listener is admitted only by the ALB SG, never by service task SGs.
        if label == "alb" and not config["alb"]:
            continue
        lines += [f"frontend {label}", f"  bind :{port} ssl crt {pem} ssl-min-ver TLSv1.2" +
                  (f" ca-file {ca} verify required" if mutual else ""),
                  "  option tcplog"]
        if mutual:
            lines += [f"  tcp-request content reject unless {{ ssl_c_s_dn(CN) -m str {clients} }}"]
        lines += ["  default_backend application"]
    lines += ["backend application", f"  option httpchk GET {config['ready_path']}",
              f"  server app 127.0.0.1:{config['app_port']} check inter 5s fall 2 rise 2"]
    for port in config["grpc_ports"]:
        lines += [f"frontend grpc_{port}", f"  bind :{port + 10000} ssl crt {pem} ca-file {ca} verify required ssl-min-ver TLSv1.2",
                  f"  tcp-request content reject unless {{ ssl_c_s_dn(CN) -m str {clients} }}",
                  f"  default_backend grpc_app_{port}", f"backend grpc_app_{port}",
                  f"  server app 127.0.0.1:{port} check inter 5s"]
    for upstream in config["upstreams"]:
        name, dns, remote = upstream["name"], upstream["dns"], upstream["remote_port"]
        lines += [f"frontend local_{name}", f"  bind 127.0.0.1:{upstream['local_port']}",
                  f"  default_backend remote_{name}", f"backend remote_{name}", "  balance roundrobin"]
        if upstream.get("ready_path"):
            lines += [f"  option httpchk GET {upstream['ready_path']}"]
        lines += [f"  server-template peer 32 {dns}:{remote} resolvers vpc resolve-prefer ipv4 init-addr none "
                  f"ssl verify required ca-file {ca} crt {pem} verifyhost {dns} sni str({dns}) "
                  "ssl-min-ver TLSv1.2 check inter 5s fall 2 rise 2"]
    return "\n".join(lines) + "\n"


def atomic(path, value):
    pending = path.with_suffix(".new")
    flags = os.O_WRONLY | os.O_CREAT | os.O_TRUNC
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    fd = os.open(pending, flags, 0o600)
    os.fchmod(fd, 0o600)
    with os.fdopen(fd, "w") as stream:
        stream.write(value)
    pending.replace(path)


def install(bundle, config):
    certificate = x509.load_pem_x509_certificate(bundle["certificate"].encode())
    key = serialization.load_pem_private_key(bundle["private_key"].encode(), password=None)
    cert_key = certificate.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
    if cert_key != key.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo):
        raise ValueError("Certificate key mismatch")
    if bundle["identity"] != config["identity"] or certificate.extensions.get_extension_for_class(x509.SubjectAlternativeName).value.get_values_for_type(x509.DNSName) != [config["identity"]]:
        raise ValueError("Certificate identity mismatch")
    if bundle["ca"].strip() != config["ca"].strip():
        raise ValueError("Unexpected trust root")
    if certificate.not_valid_after_utc.timestamp() - time.time() < 21600:
        raise ValueError("Certificate expires within six hours")
    atomic(STATE / "ca.pem", config["ca"])
    atomic(STATE / "identity.pem", bundle["certificate"] + bundle["private_key"])
    atomic(STATE / "haproxy.cfg", config_text(config))
    subprocess.run(["haproxy", "-c", "-f", str(STATE / "haproxy.cfg")], check=True)
    return hashlib.sha256(certificate.public_bytes(serialization.Encoding.DER)).hexdigest(), certificate.not_valid_after_utc.timestamp()


def probe(config, port, fingerprint):
    context = ssl.create_default_context(cafile=str(STATE / "ca.pem"))
    context.minimum_version = ssl.TLSVersion.TLSv1_2
    context.load_cert_chain(str(STATE / "identity.pem"))
    with socket.create_connection(("127.0.0.1", port), timeout=3) as raw:
        with context.wrap_socket(raw, server_hostname=config["identity"]) as encrypted:
            if hashlib.sha256(encrypted.getpeercert(binary_form=True)).hexdigest() != fingerprint:
                raise ValueError("Proxy has not activated the expected certificate")
            encrypted.sendall(f"GET {config['ready_path']} HTTP/1.1\r\nHost: {config['identity']}\r\nConnection: close\r\n\r\n".encode())
            response = http.client.HTTPResponse(encrypted)
            response.begin()
            if response.status != 200:
                raise ValueError("Application is not ready through TLS proxy")


def health(config):
    state = json.loads((STATE / "health.json").read_text())
    if time.time() - state["updated"] > 180 or state["expires"] - time.time() < 21600:
        raise ValueError("Stale supervisor or expiring certificate")
    probe(config, 19443, state["fingerprint"])
    if config["alb"]:
        probe(config, 18443, state["fingerprint"])
    for port in config["grpc_ports"]:
        with socket.create_connection(("127.0.0.1", port), timeout=3):
            pass


def serve(config):
    STATE.mkdir(parents=True, exist_ok=True)
    os.umask(0o077)
    client = boto3.client("secretsmanager")
    version, process, expires, fingerprint = None, None, 0, None
    stopping = False

    def stop(*_):
        nonlocal stopping
        stopping = True

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    try:
        while not stopping:
            if process is not None and (process.poll() is not None or expires - time.time() < 600):
                raise RuntimeError("Proxy stopped or certificate is near expiry")
            try:
                result = client.get_secret_value(SecretId=os.environ["TLS_SECRET_ARN"])
                if result["VersionId"] != version:
                    fingerprint, expires = install(json.loads(result["SecretString"]), config)
                    if process is None:
                        process = subprocess.Popen(["haproxy", "-W", "-db", "-f", str(STATE / "haproxy.cfg")])
                    else:
                        process.send_signal(signal.SIGUSR2)
                    version = result["VersionId"]
            except Exception:
                # Avoid logging keys, secret values or full SDK responses.
                logging.error("Certificate refresh failed")
                if process is None:
                    raise
            atomic(STATE / "health.json", json.dumps({"updated": time.time(), "expires": expires, "fingerprint": fingerprint}))
            for _ in range(60):
                if stopping or (process is not None and process.poll() is not None):
                    break
                time.sleep(1)
    finally:
        if process is not None and process.poll() is None:
            process.send_signal(signal.SIGUSR1)
            try:
                process.wait(timeout=25)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()


if __name__ == "__main__":
    configuration = json.loads(os.environ["TLS_CONFIG"])
    if "--health" in sys.argv:
        health(configuration)
    else:
        serve(configuration)
