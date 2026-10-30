"""Actual HAProxy handshakes/traffic in isolated Docker containers, no AWS calls.

Run after docker build -t nantty-tls-proxy:local infra/aws/tls-proxy:
python3 infra/aws/tls-proxy/test_tls.py
"""
from datetime import datetime, timedelta, timezone
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import time
import unittest
from unittest.mock import patch
import uuid

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, rsa
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("issuer", ROOT / "issuer.py")
issuer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(issuer)


def authority():
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "test-only-root")])
    now = datetime.now(timezone.utc)
    cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name)
            .public_key(key.public_key()).serial_number(x509.random_serial_number())
            .not_valid_before(now - timedelta(minutes=1)).not_valid_after(now + timedelta(days=3650))
            .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
            .add_extension(x509.KeyUsage(digital_signature=True, content_commitment=False, key_encipherment=False,
                                        data_encipherment=False, key_agreement=False, key_cert_sign=True, crl_sign=True,
                                        encipher_only=False, decipher_only=False), critical=True)
            .add_extension(x509.SubjectKeyIdentifier.from_public_key(key.public_key()), critical=False)
            .sign(key, hashes.SHA256()))
    return key, cert


def bundle(identity, ca, days=7):
    key, csr = issuer.request(identity)
    request = x509.load_pem_x509_csr(csr)
    now = datetime.now(timezone.utc)
    certificate = (x509.CertificateBuilder().subject_name(request.subject).issuer_name(ca[1].subject)
                   .public_key(key.public_key()).serial_number(x509.random_serial_number())
                   .not_valid_before(now - timedelta(minutes=1)).not_valid_after(now + timedelta(days=days))
                   .add_extension(request.extensions.get_extension_for_class(x509.SubjectAlternativeName).value, critical=False)
                   .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
                   .add_extension(x509.AuthorityKeyIdentifier.from_issuer_public_key(ca[0].public_key()), critical=False)
                   .add_extension(x509.SubjectKeyIdentifier.from_public_key(key.public_key()), critical=False)
                   .add_extension(x509.KeyUsage(digital_signature=True, content_commitment=False, key_encipherment=False,
                                               data_encipherment=False, key_agreement=False, key_cert_sign=False, crl_sign=False,
                                               encipher_only=False, decipher_only=False), critical=True)
                   .add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH, ExtendedKeyUsageOID.CLIENT_AUTH]), critical=False)
                   .sign(ca[0], hashes.SHA256()))
    value = {"identity": identity, "ca": ca[1].public_bytes(serialization.Encoding.PEM).decode(),
             "certificate": certificate.public_bytes(serialization.Encoding.PEM).decode(),
             "private_key": key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()).decode()}
    return value, key


def docker(*args, check=True):
    return subprocess.run(["docker", *args], check=check, text=True, capture_output=True)


class IssuerTests(unittest.TestCase):
    def test_issuer_owns_identity_and_rotation(self):
        ca = authority()

        class Missing(Exception):
            pass

        class Secrets:
            exceptions = type("Exceptions", (), {"ResourceNotFoundException": Missing})
            current = None

            def get_secret_value(self, **kwargs):
                self.assert_secret(kwargs)
                if self.current is None:
                    raise Missing()
                return {"SecretString": json.dumps(self.current)}

            def assert_secret(self, kwargs):
                if kwargs["SecretId"] != "owned-secret":
                    raise AssertionError("Issuer accessed another service secret")

            def put_secret_value(self, **kwargs):
                self.assert_secret(kwargs)
                self.current = json.loads(kwargs["SecretString"])

        class PCA:
            issues = 0

            def get_certificate_authority_certificate(self, **_):
                return {"Certificate": ca[1].public_bytes(serialization.Encoding.PEM).decode()}

            def issue_certificate(self, **kwargs):
                self.issues += 1
                csr = x509.load_pem_x509_csr(kwargs["Csr"])
                now = datetime.now(timezone.utc)
                cert = (x509.CertificateBuilder().subject_name(csr.subject).issuer_name(ca[1].subject)
                        .public_key(csr.public_key()).serial_number(x509.random_serial_number())
                        .not_valid_before(now - timedelta(minutes=1)).not_valid_after(now + timedelta(days=7))
                        .add_extension(csr.extensions.get_extension_for_class(x509.SubjectAlternativeName).value, critical=False)
                        .add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH, ExtendedKeyUsageOID.CLIENT_AUTH]), critical=False)
                        .sign(ca[0], hashes.SHA256()))
                self.pem = cert.public_bytes(serialization.Encoding.PEM).decode()
                return {"CertificateArn": "issued"}

            def get_waiter(self, _):
                return type("Waiter", (), {"wait": lambda *_args, **_kwargs: None})()

            def get_certificate(self, **_):
                return {"Certificate": self.pem}

        sm, pca = Secrets(), PCA()
        metrics = type("Metrics", (), {"put_metric_data": lambda *_args, **_kwargs: None})()
        clients = {"secretsmanager": sm, "acm-pca": pca, "cloudwatch": metrics}
        with patch.dict("os.environ", {"IDENTITY": "owned.mesh", "CA_ARN": "root", "SECRET_ARN": "owned-secret", "SERVICE_NAME": "owned", "METRIC_NAMESPACE": "Nantty/test/TLS"}), patch.object(issuer.boto3, "client", side_effect=lambda name: clients[name]):
            result = issuer.handler({"IDENTITY": "victim.mesh", "SecretId": "victim-secret"}, None)
            self.assertEqual(result["identity"], "owned.mesh")
            self.assertNotIn("private_key", result)
            self.assertFalse(issuer.handler({}, None)["renewed"])
            self.assertEqual(pca.issues, 1)
            # A new trust root forces issuance even while the old leaf is young.
            ca = authority()
            self.assertTrue(issuer.handler({}, None)["renewed"])
            self.assertEqual(pca.issues, 2)

    def test_identity_key_signature_and_lifetime(self):
        ca = authority()
        value, key = bundle("service.mesh", ca)
        issuer.validate(value["certificate"], key, value["ca"], "service.mesh")
        for identity, signing_key, trust in [
            ("other.mesh", key, value["ca"]),
            ("service.mesh", ec.generate_private_key(ec.SECP256R1()), value["ca"]),
            ("service.mesh", key, authority()[1].public_bytes(serialization.Encoding.PEM).decode()),
        ]:
            with self.assertRaises(Exception):
                issuer.validate(value["certificate"], signing_key, trust, identity)
        short, key = bundle("service.mesh", ca, days=0.1)
        with self.assertRaises(ValueError):
            issuer.validate(short["certificate"], key, short["ca"], "service.mesh")


class TrafficTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix="nantty-tls-test-")
        cls.path = Path(cls.temp.name)
        cls.network = "nantty-tls-test-" + uuid.uuid4().hex[:10]
        cls.containers = []
        cls.ca = authority()
        cls.configs = {}
        docker("network", "create", cls.network)
        try:
            for name in ["server", "client"]:
                directory = cls.path / name
                directory.mkdir()
                value, _ = bundle(f"{name}.mesh", cls.ca)
                (directory / "bundle.json").write_text(json.dumps(value))
                (directory / "ready").touch()
                config = {"identity": f"{name}.mesh", "ca": value["ca"], "app_port": 8080,
                          "ready_path": "/readyz", "alb": name == "server", "grpc_ports": [9103],
                          "clients": ["client.mesh"], "upstreams": []}
                if name == "client":
                    config["upstreams"] = [
                        {"name": "http", "dns": "server.mesh", "remote_port": 19443, "local_port": 20000, "ready_path": "/readyz"},
                        {"name": "grpc", "dns": "server.mesh", "remote_port": 19103, "local_port": 29103},
                        {"name": "wrong-san", "dns": "wrong.mesh", "remote_port": 19443, "local_port": 20001},
                    ]
                cls.configs[name] = config
                container = cls.network + "-" + name
                cls.containers.append(container)
                args = ["run", "-d", "--name", container, "--network", cls.network, "--network-alias", f"{name}.mesh",
                        "--user", "0", "--read-only", "--cap-drop", "ALL", "--tmpfs", "/run/tls:rw,noexec,nosuid,size=8m",
                        "-v", f"{ROOT}:/work:ro", "-v", f"{directory}:/fixtures:ro", "-e", "TLS_SECRET_ARN=fixture-only",
                        "-e", "PYTHONDONTWRITEBYTECODE=1", "-e", "TLS_CONFIG=" + json.dumps(config),
                        "--entrypoint", "python3"]
                if name == "server":
                    args[args.index("--user"):args.index("--user")] = ["--network-alias", "wrong.mesh"]
                docker(*args, "nantty-tls-proxy:local", "/work/test_runtime.py")
            cls.wait_for(lambda: cls.run_code("client", 'import urllib.request; assert urllib.request.urlopen("http://127.0.0.1:20000/readyz",timeout=3).status == 200').returncode == 0)
        except Exception:
            cls.tearDownClass()
            raise

    @classmethod
    def run_code(cls, name, code):
        return docker("exec", cls.network + "-" + name, "python3", "-c", code, check=False)

    @classmethod
    def wait_for(cls, check, timeout=35):
        until = time.monotonic() + timeout
        while time.monotonic() < until:
            if check():
                return
            time.sleep(1)
        for container in cls.containers:
            print(docker("logs", "--tail", "20", container, check=False).stdout)
        raise AssertionError("TLS readiness timed out")

    @classmethod
    def tearDownClass(cls):
        for container in cls.containers:
            docker("rm", "-f", container, check=False)
        docker("network", "rm", cls.network, check=False)
        cls.temp.cleanup()

    def test_01_http_grpc_and_no_plaintext(self):
        result = self.run_code("client", 'import socket; s=socket.create_connection(("127.0.0.1",29103),3); s.sendall(b"grpc-stream"); assert s.recv(64)==b"grpc-stream"')
        self.assertEqual(result.returncode, 0, result.stderr)
        result = self.run_code("client", 'import socket; s=socket.create_connection(("server.mesh",19443),3); s.sendall(b"GET /readyz HTTP/1.0\\r\\n\\r\\n"); s.settimeout(3); print(repr(s.recv(256)))')
        # A reset, timeout, or empty response all prove no plaintext HTTP response.
        self.assertNotIn("ready", result.stdout)
        self.assertNotIn("200", result.stdout)
        result = self.run_code("client", 'import urllib.request; urllib.request.urlopen("http://127.0.0.1:20001/readyz",timeout=3)')
        self.assertNotEqual(result.returncode, 0, "Wrong server SAN was accepted")

    def test_02_client_identity_required(self):
        for mode in ["no-certificate", "untrusted", "wrong-identity"]:
            value, _ = bundle("intruder.mesh", authority() if mode == "untrusted" else self.ca)
            (self.path / "client" / "intruder.pem").write_text(value["certificate"] + value["private_key"])
            code = 'import ssl,socket; c=ssl.create_default_context(cadata=' + repr(self.configs["client"]["ca"]) + '); '
            if mode != "no-certificate":
                code += 'c.load_cert_chain("/fixtures/intruder.pem"); '
            code += 's=c.wrap_socket(socket.create_connection(("server.mesh",19443),3),server_hostname="server.mesh"); s.sendall(b"GET /readyz HTTP/1.0\\r\\n\\r\\n"); assert b"200" in s.recv(1024)'
            self.assertNotEqual(self.run_code("client", code).returncode, 0, mode)

    def test_03_readiness_tracks_application(self):
        ready = self.path / "server" / "ready"
        ready.unlink()
        try:
            result = docker("exec", self.network + "-server", "python3", "/opt/nantty/proxy.py", "--health", check=False)
            self.assertNotEqual(result.returncode, 0)
        finally:
            ready.touch()

    def test_04_certificate_rotation_without_task_restart(self):
        value, _ = bundle("server.mesh", self.ca)
        pending = self.path / "server" / "bundle.new"
        pending.write_text(json.dumps(value))
        pending.replace(self.path / "server" / "bundle.json")
        new_serial = x509.load_pem_x509_certificate(value["certificate"].encode()).serial_number
        code = ('import ssl,socket; from cryptography import x509; '
                'c=ssl.create_default_context(cadata=' + repr(value["ca"]) + '); '
                's=c.wrap_socket(socket.create_connection(("server.mesh",18443),3),server_hostname="server.mesh"); '
                f'assert x509.load_der_x509_certificate(s.getpeercert(binary_form=True)).serial_number == {new_serial}')
        self.wait_for(lambda: self.run_code("client", code).returncode == 0, timeout=80)
        result = docker("exec", self.network + "-server", "python3", "/opt/nantty/proxy.py", "--health", check=False)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(docker("inspect", "--format", "{{.RestartCount}}", self.network + "-server").stdout.strip(), "0")


if __name__ == "__main__":
    unittest.main(verbosity=2)
