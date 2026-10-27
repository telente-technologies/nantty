# Intelligence gets its own small Valkey instead of a logical DB on the shared cluster:
# its feature state is large and write-heavy, and on the shared volatile-lru cluster it would
# evict TTL'd security keys (session denylist, rate limits, idempotency). A separate cluster
# also lets the security group admit the intelligence task alone.

resource "aws_security_group" "intelligence" {
  name_prefix = "${local.tags_prefix}-intelligence-"
  description = "Identity of the intelligence task; its Valkey accepts only this group"
  vpc_id      = module.network.vpc_id
  egress {
    description = "Valkey TLS inside the VPC"
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }
  lifecycle { create_before_destroy = true }
}

module "valkey_intelligence" {
  source                    = "../valkey"
  environment               = var.environment
  name_suffix               = "-intelligence"
  description               = "nantty ${var.environment} intelligence feature state, replay nonces, dedup keys"
  vpc_id                    = module.network.vpc_id
  data_subnet_ids           = module.network.data_subnet_ids
  client_security_group_ids = [aws_security_group.intelligence.id]
  data_kms_key_arn          = module.kms.key_arns["data"]
  secrets_kms_key_arn       = module.kms.key_arns["secrets"]
  logs_kms_key_arn          = module.kms.key_arns["logs"]
  node_type                 = var.intelligence_valkey.node_type
  node_count                = var.intelligence_valkey.node_count
}
