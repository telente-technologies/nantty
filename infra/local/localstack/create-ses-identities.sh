#!/usr/bin/env bash
set -euo pipefail
awslocal sesv2 create-email-identity --email-identity no-reply@zudomart.local >/dev/null || true
awslocal sesv2 create-configuration-set --configuration-set-name zudomart-transactional >/dev/null || true
touch /tmp/zudomart-ses-ready
