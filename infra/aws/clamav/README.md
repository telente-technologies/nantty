# Media malware scanner

The media task runs this pinned, official ClamAV container as a private sidecar under the `clamav` user using ClamAV's `/init-unprivileged` entrypoint. The scanner has no public listener: it binds TCP only to task-local loopback and accepts streams only from the media container in the same ECS task. Nantty still rejects a skipped or failed scan.

`clamd.conf` raises the stream and file limits to 510 MiB, above the media policy's maximum 500 MiB upload, while preserving bounded archive recursion, file count, total scan size, and scan duration. Exceeded scan limits are reported as findings and rejected rather than treated as clean. Password-protected archives and documents are also rejected because their contents cannot be inspected. The image build downloads current signatures from ClamAV; the task does not need outbound internet access. A daily GitHub workflow refreshes and deploys the scanner image only after an EICAR integration test passes. The scanner reserves 4 GiB of task memory; ClamAV upstream recommends 4 GiB because its signature databases consume substantial RAM. Staging reduces the media service to one minimum task, but the added RAM has a real AWS cost. Review the spend limit and Terraform plan before applying.

The staging configuration is code only until Terraform is applied and the deployment workflow completes. After staging exists, enable the scheduled refresh with repository variable `CLAMAV_REFRESH_ENABLED_STAGING=true`; it refreshes the image daily, tests it, and rolls only the scanner container. Staging disables the unavailable child-safety matcher explicitly and is suitable only for controlled test accounts, not real public uploads. Production keeps child-safety scanning required and will hold media until an approved matcher is configured. ClamAV detects malware signatures; it does not prove an otherwise-valid image or document is safe, perform OCR/document understanding, provide CSAM matching, or inspect encrypted chat plaintext. The Go child-safety matcher remains fail-closed and unavailable pending a vetted provider, authorized match data, and approved credentials.

For local testing, run the optional scanner profile (requires about 4 GiB free memory):

```sh
CLAMAV_HOST=127.0.0.1 docker compose --profile malware-scan up --build media clamav
CLAMAV_TEST_HOST=127.0.0.1 pnpm --filter @nantty/media exec vitest run tests/integrations/clamAv.e2e.test.ts
```

The e2e test sends the harmless EICAR test signature through Nantty's real TCP `INSTREAM` client and expects the ClamAV infected verdict. Do not upload real malware samples. A deployment is not verified until this test and an authorized clean-file upload succeed against the deployed scanner.
