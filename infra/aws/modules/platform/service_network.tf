# The shared tasks group grants data-store access only. Unique groups prevent a
# compromised task from reaching another task's HTTP, metrics or debug sockets.
resource "aws_vpc_security_group_egress_rule" "task_https" {
  for_each          = toset(var.service_internet_egress_cidrs)
  security_group_id = aws_security_group.tasks.id
  description       = "HTTPS to reviewed external service CIDR ${each.value}"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = each.value
}

resource "aws_security_group" "service" {
  for_each    = { for name, definition in local.services : name => definition if name != "go-money" }
  name_prefix = "${local.tags_prefix}-${each.key}-"
  description = "Service ingress identity for ${each.key}"
  vpc_id      = module.network.vpc_id
  lifecycle { create_before_destroy = true }
}

resource "aws_vpc_security_group_ingress_rule" "identity_grpc" {
  for_each                     = toset(["go-money", "go-live"])
  security_group_id            = aws_security_group.service["go-identity"].id
  referenced_security_group_id = each.key == "go-money" ? aws_security_group.payments.id : aws_security_group.service[each.key].id
  ip_protocol                  = "tcp"
  from_port                    = 19101
  to_port                      = 19101
  description                  = "Account directory mTLS from ${each.key}"
}

resource "aws_vpc_security_group_egress_rule" "store_clients" {
  for_each = {
    aurora   = { port = 5432, group = module.aurora.security_group_id }
    valkey   = { port = 6379, group = module.valkey.security_group_id }
    rabbitmq = { port = 5671, group = module.messaging.security_group_id }
  }
  security_group_id            = aws_security_group.tasks.id
  referenced_security_group_id = each.value.group
  ip_protocol                  = "tcp"
  from_port                    = each.value.port
  to_port                      = each.value.port
  description                  = "Shared clients to ${each.key} only"
}

resource "aws_vpc_security_group_egress_rule" "money_grpc_clients" {
  for_each                     = toset(["go-commerce", "go-live", "go-ads"])
  security_group_id            = aws_security_group.service[each.key].id
  referenced_security_group_id = aws_security_group.payments.id
  ip_protocol                  = "tcp"
  from_port                    = 19103
  to_port                      = 19103
}

resource "aws_vpc_security_group_egress_rule" "live_identity_grpc" {
  security_group_id            = aws_security_group.service["go-live"].id
  referenced_security_group_id = aws_security_group.service["go-identity"].id
  ip_protocol                  = "tcp"
  from_port                    = 19101
  to_port                      = 19101
}

locals {
  tls_http_edges = merge([for target, clients in local.tls_http_clients : {
    for client in clients : "${client}-to-${target}" => { client = client, target = target }
  }]...)
  service_security_groups = merge({ for name, group in aws_security_group.service : name => group.id }, { go-money = aws_security_group.payments.id })
}

resource "aws_vpc_security_group_ingress_rule" "mesh_http" {
  for_each                     = local.tls_http_edges
  security_group_id            = local.service_security_groups[each.value.target]
  referenced_security_group_id = local.service_security_groups[each.value.client]
  ip_protocol                  = "tcp"
  from_port                    = 19443
  to_port                      = 19443
  description                  = "mTLS HTTP from ${each.value.client}"
}

resource "aws_vpc_security_group_egress_rule" "mesh_http" {
  for_each                     = local.tls_http_edges
  security_group_id            = local.service_security_groups[each.value.client]
  referenced_security_group_id = local.service_security_groups[each.value.target]
  ip_protocol                  = "tcp"
  from_port                    = 19443
  to_port                      = 19443
  description                  = "mTLS HTTP to ${each.value.target}"
}
