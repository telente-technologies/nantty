FROM clamav/clamav:1.5.5_base-debian13-slim@sha256:523277ba4a20c7b854babe0dbe9ca92d771d3119fc96f71b0b31e34d37924b15

RUN freshclam --stdout && chown -R clamav:clamav /var/lib/clamav
COPY --chown=clamav:clamav clamd.conf /etc/clamav/clamd.conf
