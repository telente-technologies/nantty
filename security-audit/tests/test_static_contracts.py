"""Safe source-level contracts; these tests do not contact services or databases."""

from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[2]


class StaticSecurityContracts(unittest.TestCase):
    def test_space_api_has_explicit_gateway_route(self) -> None:
        gateway_routes = (ROOT / "services/typescript/gateway/src/routes/upstream.routes.ts").read_text()
        routed_paths = re.findall(r'pathPrefix:\s*"([^"]+)"[^}]*upstream:\s*"([^"]+)"', gateway_routes)
        self.assertTrue(
            any(path.rstrip("/") == "/api/v1/spaces" and upstream == "live" for path, upstream in routed_paths),
            "Space API handlers exist in Go but no gateway route is registered.",
        )

    def test_local_ledger_runtime_role_does_not_own_schema(self) -> None:
        bootstrap = (ROOT / "infra/local/postgres/create-databases.sh").read_text()
        self.assertIn('CREATE ROLE svc_migrator LOGIN', bootstrap)
        self.assertIn('CREATE SCHEMA ${service} AUTHORIZATION svc_migrator', bootstrap)
        self.assertNotIn('GRANT svc_payments, svc_wallet, svc_escrow, svc_subscriptions, svc_creators TO svc_money', bootstrap)
        self.assertIn('money_schemas="payments wallet ledger escrow subscriptions creators"', bootstrap)
        self.assertNotIn('CREATE ROLE svc_ledger', bootstrap)
        self.assertNotIn('GRANT svc_migrator TO svc_money', bootstrap)
        self.assertIn('ALTER DEFAULT PRIVILEGES FOR ROLE svc_migrator IN SCHEMA ${schema}', bootstrap)
        self.assertIn('GRANT SELECT, INSERT, UPDATE ON TABLES TO svc_money', bootstrap)
        self.assertNotIn('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO svc_money', bootstrap)
        delete_grants = {
            "payments": "provider_payout_destinations",
            "creators": "creator_brand_deals",
            "ledger": "step_up_consumptions",
        }
        for module, table in delete_grants.items():
            migration = ROOT / f"services/go/modules/{module}/src/migrations/20261029150000_runtime_delete_grants.up.sql"
            self.assertIn(f"GRANT DELETE ON {table} TO svc_money", migration.read_text())

    def test_ledger_migrations_are_external_and_use_only_the_migrator_identity(self) -> None:
        loader = (ROOT / "services/go/modules/ledger/src/loaders/moneyModule.loader.go").read_text()
        runner = (ROOT / "services/go/deployables/goMoney/ledgerMigration.go").read_text()
        entrypoint = (ROOT / "services/go/deployables/goMoney/server.go").read_text()
        terraform = (ROOT / "infra/aws/modules/platform/deploy.tf").read_text()
        workflow = (ROOT / ".github/workflows/deploy.yml").read_text()
        migration_task = (ROOT / ".github/scripts/runMigrationTask.sh").read_text()

        self.assertIn('return false', loader)
        self.assertIn('parsed.User.Username() != "svc_migrator"', runner)
        self.assertIn('query.Del("options")', runner)
        self.assertIn('os.Args[1] == "--migrate-money"', entrypoint)
        for module in ("PAYMENTS", "WALLET", "LEDGER", "ESCROW", "SUBSCRIPTIONS", "CREATORS"):
            self.assertIn(f'{module}_MIGRATE_ON_START', terraform)
        self.assertIn('MONEY_MIGRATION_DATABASE_URL', migration_task)
        self.assertIn('MIGRATION_IMAGE:', workflow)

    def test_runtime_egress_is_not_open_to_every_ipv4_host(self) -> None:
        service_network = (ROOT / "infra/aws/modules/platform/service_network.tf").read_text()
        payments_egress = (ROOT / "infra/aws/modules/platform/payments_egress.tf").read_text()
        platform_variables = (ROOT / "infra/aws/modules/platform/variables.tf").read_text()
        self.assertIn('for_each          = toset(var.service_internet_egress_cidrs)', service_network)
        self.assertIn('cidr_ipv4         = each.value', service_network)
        self.assertIn('for_each          = toset(var.payments_internet_egress_cidrs)', payments_egress)
        self.assertIn('cidr_ipv4         = each.value', payments_egress)
        for variable in ("payments_internet_egress_cidrs", "service_internet_egress_cidrs"):
            declaration = re.search(rf'variable "{variable}"\s*\{{(.*?)\n\}}', platform_variables, re.DOTALL)
            self.assertIsNotNone(declaration, f"Missing egress variable {variable}.")
            assert declaration is not None
            self.assertRegex(declaration.group(1), r"default\s*=\s*\[\]")
            self.assertIn('cidr != "0.0.0.0/0"', declaration.group(1))

    def test_production_admin_allowlist_is_required(self) -> None:
        gateway = (ROOT / "services/typescript/gateway/src/configs/gateway.config.ts").read_text()
        self.assertIn('process.env["NODE_ENV"] === "production"', gateway)
        self.assertIn('"ADMIN_IP_ALLOWLIST is required outside development"', gateway)

    def test_deploy_workflow_covers_all_platform_services_and_shared_packages(self) -> None:
        workflow = (ROOT / ".github/workflows/deploy.yml").read_text()
        self.assertIn('"packages/**"', workflow, "Shared package changes must trigger deploy CI.")

        for service in ("search", "support"):
            self.assertRegex(
                workflow,
                rf"service:\s*{service}\b",
                f"{service} must be built and scanned by the deploy matrix.",
            )
            self.assertGreaterEqual(
                workflow.count(service),
                4,
                f"{service} must be present in build, staging rollout, and production rollout.",
            )


if __name__ == "__main__":
    unittest.main()
