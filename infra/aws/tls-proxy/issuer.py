"""One immutable service identity per Lambda; event input cannot choose a SAN/secret.

EventBridge renews daily. Terraform invokes once for bootstrap. Only this role can
write its service secret or issue certificates; tasks can only read their own PEM.
"""
import hashlib
import json
import os
from datetime import datetime, timezone

import boto3
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, padding
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID


def request(identity):
    key = ec.generate_private_key(ec.SECP256R1())
    csr = (x509.CertificateSigningRequestBuilder()
           .subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, identity)]))
           .add_extension(x509.SubjectAlternativeName([x509.DNSName(identity)]), critical=False)
           .sign(key, hashes.SHA256()))
    return key, csr.public_bytes(serialization.Encoding.PEM)


def validate(cert_pem, key, ca_pem, identity):
    cert = x509.load_pem_x509_certificate(cert_pem.encode())
    ca = x509.load_pem_x509_certificate(ca_pem.encode())
    if cert.issuer != ca.subject:
        raise ValueError("Certificate issuer mismatch")
    ca.public_key().verify(cert.signature, cert.tbs_certificate_bytes,
                           padding.PKCS1v15(), cert.signature_hash_algorithm)
    if cert.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo) != key.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo):
        raise ValueError("Certificate key mismatch")
    if cert.extensions.get_extension_for_class(x509.SubjectAlternativeName).value.get_values_for_type(x509.DNSName) != [identity]:
        raise ValueError("Certificate SAN mismatch")
    eku = cert.extensions.get_extension_for_class(x509.ExtendedKeyUsage).value
    if not all(usage in eku for usage in [ExtendedKeyUsageOID.SERVER_AUTH, ExtendedKeyUsageOID.CLIENT_AUTH]):
        raise ValueError("Certificate must support both server and client authentication")
    if cert.not_valid_after_utc.timestamp() - datetime.now(timezone.utc).timestamp() < 86400:
        raise ValueError("Certificate has insufficient lifetime")
    return cert


def handler(event, context):
    identity, ca_arn, secret = (os.environ[name] for name in ["IDENTITY", "CA_ARN", "SECRET_ARN"])
    pca, sm = boto3.client("acm-pca"), boto3.client("secretsmanager")
    ca = pca.get_certificate_authority_certificate(CertificateAuthorityArn=ca_arn)["Certificate"]
    if x509.load_pem_x509_certificate(ca.encode()).not_valid_after_utc.timestamp() - datetime.now(timezone.utc).timestamp() < 90 * 86400:
        raise ValueError("Trust root expires within 90 days; coordinated root rollover required")
    # Retries after a successful write reuse a young certificate. No private keys
    # or certificate contents are returned to Terraform, logs or EventBridge.
    try:
        current = json.loads(sm.get_secret_value(SecretId=secret)["SecretString"])
        expiry = x509.load_pem_x509_certificate(current["certificate"].encode()).not_valid_after_utc
        if current.get("identity") == identity and current.get("ca", "").strip() == ca.strip() and expiry.timestamp() - datetime.now(timezone.utc).timestamp() > 5 * 86400:
            heartbeat()
            return {"identity": identity, "renewed": False}
    except sm.exceptions.ResourceNotFoundException:
        pass
    key, csr = request(identity)
    token = hashlib.sha256(csr).hexdigest()[:32]
    certificate_arn = pca.issue_certificate(
        CertificateAuthorityArn=ca_arn, Csr=csr, SigningAlgorithm="SHA256WITHRSA",
        TemplateArn="arn:aws:acm-pca:::template/EndEntityCertificate_APICSRPassthrough/V1",
        ApiPassthrough={"Extensions": {"ExtendedKeyUsage": [
            {"ExtendedKeyUsageType": "SERVER_AUTH"}, {"ExtendedKeyUsageType": "CLIENT_AUTH"}]}},
        Validity={"Type": "DAYS", "Value": 7}, IdempotencyToken=token,
    )["CertificateArn"]
    pca.get_waiter("certificate_issued").wait(
        CertificateAuthorityArn=ca_arn, CertificateArn=certificate_arn,
        WaiterConfig={"Delay": 2, "MaxAttempts": 30})
    issued = pca.get_certificate(CertificateAuthorityArn=ca_arn, CertificateArn=certificate_arn)
    cert = validate(issued["Certificate"], key, ca, identity)
    sm.put_secret_value(SecretId=secret, ClientRequestToken=hashlib.sha256(csr).hexdigest(), SecretString=json.dumps({
        "identity": identity, "certificate": issued["Certificate"], "ca": ca,
        "private_key": key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                         serialization.NoEncryption()).decode(),
    }))
    heartbeat()
    return {"identity": identity, "renewed": True, "expires_at": cert.not_valid_after_utc.isoformat()}


def heartbeat():
    boto3.client("cloudwatch").put_metric_data(Namespace=os.environ["METRIC_NAMESPACE"], MetricData=[{
        "MetricName": "RotationCheckSuccess", "Value": 1, "Unit": "Count",
        "Dimensions": [{"Name": "Service", "Value": os.environ["SERVICE_NAME"]}],
    }])
