resource "aws_secretsmanager_secret" "app" {
  for_each   = local.services
  name       = "zudomart/${var.environment}/${each.key}/app"
  kms_key_id = module.kms.key_arns["secrets"]
  dynamic "replica" {
    for_each = var.enable_dr ? [1] : []
    content {
      region     = var.dr_region
      kms_key_id = module.kms_dr[0].key_arns["secrets"]
    }
  }
}

resource "aws_secretsmanager_secret_version" "app" {
  for_each      = local.services
  secret_id     = aws_secretsmanager_secret.app[each.key].id
  secret_string = jsonencode({ for key in each.value.secret_keys : key => "CHANGE_ME" })
  lifecycle { ignore_changes = [secret_string] }
}
