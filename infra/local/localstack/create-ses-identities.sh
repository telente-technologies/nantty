#!/usr/bin/env bash
set -euo pipefail
awslocal sesv2 create-email-identity --email-identity no-reply@nantty.local >/dev/null || true
awslocal sesv2 create-configuration-set --configuration-set-name nantty-transactional >/dev/null || true
touch /tmp/nantty-ses-ready
