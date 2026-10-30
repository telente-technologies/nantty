# HAProxy 3.2 is an upstream LTS branch. Rebuild/scan on every deployment.
FROM haproxy:3.2-alpine
USER root
RUN apk add --no-cache python3 py3-boto3 py3-cryptography
COPY proxy.py /opt/nantty/proxy.py
USER haproxy
ENTRYPOINT ["python3", "/opt/nantty/proxy.py"]
