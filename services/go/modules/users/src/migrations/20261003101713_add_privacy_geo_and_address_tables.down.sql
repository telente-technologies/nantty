-- reverse: create index "userconsent_device_id_consent_type_created_at" to table: "user_consents"
DROP INDEX "userconsent_device_id_consent_type_created_at";
-- reverse: create index "userconsent_account_id_consent_type_created_at" to table: "user_consents"
DROP INDEX "userconsent_account_id_consent_type_created_at";
-- reverse: create "user_consents" table
DROP TABLE "user_consents";
-- reverse: create index "termsacceptance_account_id_terms_version" to table: "terms_acceptances"
DROP INDEX "termsacceptance_account_id_terms_version";
-- reverse: create "terms_acceptances" table
DROP TABLE "terms_acceptances";
-- reverse: create index "shippingaddress_account_id_created_at" to table: "shipping_addresses"
DROP INDEX "shippingaddress_account_id_created_at";
-- reverse: create "shipping_addresses" table
DROP TABLE "shipping_addresses";
-- reverse: create index "retentionpolicy_category" to table: "retention_policies"
DROP INDEX "retentionpolicy_category";
-- reverse: create "retention_policies" table
DROP TABLE "retention_policies";
-- reverse: create index "privacysetting_account_id" to table: "privacy_settings"
DROP INDEX "privacysetting_account_id";
-- reverse: create "privacy_settings" table
DROP TABLE "privacy_settings";
-- reverse: create index "policyversion_kind_version" to table: "policy_versions"
DROP INDEX "policyversion_kind_version";
-- reverse: create index "policyversion_kind_effective_at" to table: "policy_versions"
DROP INDEX "policyversion_kind_effective_at";
-- reverse: create "policy_versions" table
DROP TABLE "policy_versions";
-- reverse: create index "georegion_country_id" to table: "geo_regions"
DROP INDEX "georegion_country_id";
-- reverse: create index "georegion_country_code_name" to table: "geo_regions"
DROP INDEX "georegion_country_code_name";
-- reverse: create "geo_regions" table
DROP TABLE "geo_regions";
-- reverse: create index "geocountry_code" to table: "geo_countries"
DROP INDEX "geocountry_code";
-- reverse: create "geo_countries" table
DROP TABLE "geo_countries";
-- reverse: create index "geocity_region_id_name" to table: "geo_cities"
DROP INDEX "geocity_region_id_name";
-- reverse: create index "geocity_admin_area_id" to table: "geo_cities"
DROP INDEX "geocity_admin_area_id";
-- reverse: create "geo_cities" table
DROP TABLE "geo_cities";
-- reverse: create index "geoadminarea_region_id_name" to table: "geo_admin_areas"
DROP INDEX "geoadminarea_region_id_name";
-- reverse: create "geo_admin_areas" table
DROP TABLE "geo_admin_areas";
-- reverse: create index "deletionrequest_status_scheduled_for" to table: "deletion_requests"
DROP INDEX "deletionrequest_status_scheduled_for";
-- reverse: create index "deletionrequest_account_id_status" to table: "deletion_requests"
DROP INDEX "deletionrequest_account_id_status";
-- reverse: create "deletion_requests" table
DROP TABLE "deletion_requests";
-- reverse: create index "dataexportrequest_status_created_at" to table: "data_export_requests"
DROP INDEX "dataexportrequest_status_created_at";
-- reverse: create index "dataexportrequest_account_id_idempotency_key" to table: "data_export_requests"
DROP INDEX "dataexportrequest_account_id_idempotency_key";
-- reverse: create "data_export_requests" table
DROP TABLE "data_export_requests";
