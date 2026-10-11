# go-money runs in its own security group instead of the shared task group. Inside the VPC it
# may reach only the stores and services it uses; on the internet only HTTPS (Flutterwave,
# Apple App Store and Google Play APIs). Security groups cannot filter by hostname, so the
# internet rule is limited by CIDR (payments_internet_egress_cidrs) and is the documented gap.

resource "aws_security_group" "payments" {
  name_prefix = "${local.tags_prefix}-payments-"
  description = "go-money (payments): egress limited to its dependencies"
  vpc_id      = module.network.vpc_id
  lifecycle { create_before_destroy = true }
}

locals {
  payments_egress_to_groups = {
    aurora       = { port = 5432, group = module.aurora.security_group_id, description = "PostgreSQL via RDS Proxy" }
    valkey       = { port = 6379, group = module.valkey.security_group_id, description = "Valkey TLS (session denylist, idempotency)" }
    rabbitmq     = { port = 5671, group = module.messaging.security_group_id, description = "Amazon MQ AMQPS" }
    internal_alb = { port = 80, group = module.edge.internal_alb_security_group_id, description = "Internal services through the internal ALB" }
    identity     = { port = 9101, group = aws_security_group.tasks.id, description = "go-identity account directory gRPC (Cloud Map)" }
    endpoints    = { port = 443, group = module.network.endpoints_security_group_id, description = "AWS interface VPC endpoints" }
  }
}

resource "aws_vpc_security_group_egress_rule" "payments_to_group" {
  for_each                     = local.payments_egress_to_groups
  security_group_id            = aws_security_group.payments.id
  description                  = each.value.description
  ip_protocol                  = "tcp"
  from_port                    = each.value.port
  to_port                      = each.value.port
  referenced_security_group_id = each.value.group
}

resource "aws_vpc_security_group_egress_rule" "payments_to_s3" {
  security_group_id = aws_security_group.payments.id
  description       = "S3 through the gateway endpoint (ECR image layers)"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  prefix_list_id    = module.network.s3_prefix_list_id
}

resource "aws_vpc_security_group_egress_rule" "payments_to_internet" {
  for_each          = toset(var.payments_internet_egress_cidrs)
  security_group_id = aws_security_group.payments.id
  description       = "HTTPS to Flutterwave, App Store and Google Play APIs through NAT"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = each.value
}

resource "aws_vpc_security_group_ingress_rule" "payments_from_internal_alb" {
  security_group_id            = aws_security_group.payments.id
  description                  = "Internal ALB to go-money HTTP"
  ip_protocol                  = "tcp"
  from_port                    = 8080
  to_port                      = 8080
  referenced_security_group_id = module.edge.internal_alb_security_group_id
}

resource "aws_vpc_security_group_ingress_rule" "payments_grpc_from_tasks" {
  security_group_id            = aws_security_group.payments.id
  description                  = "Money gRPC from go-commerce, go-live and go-ads (Cloud Map)"
  ip_protocol                  = "tcp"
  from_port                    = 9103
  to_port                      = 9103
  referenced_security_group_id = aws_security_group.tasks.id
}
