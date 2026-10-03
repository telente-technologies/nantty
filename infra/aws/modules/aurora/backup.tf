resource "aws_backup_vault" "primary" {
  name        = "${local.name}-aurora"
  kms_key_arn = var.backup_kms_key_arn
}

resource "aws_backup_vault" "dr" {
  provider    = aws.dr
  count       = var.enable_dr ? 1 : 0
  name        = "${local.name}-aurora-dr"
  kms_key_arn = var.dr_backup_kms_key_arn
}

resource "aws_backup_plan" "aurora" {
  name = "${local.name}-aurora"

  rule {
    rule_name         = "daily-with-cross-region-copy"
    target_vault_name = aws_backup_vault.primary.name
    schedule          = "cron(0 3 * * ? *)"
    start_window      = 60
    completion_window = 240
    lifecycle { delete_after = var.backup_retention_days }
    dynamic "copy_action" {
      for_each = var.enable_dr ? [1] : []
      content {
        destination_vault_arn = aws_backup_vault.dr[0].arn
        lifecycle { delete_after = var.dr_snapshot_retention_days }
      }
    }
  }

  rule {
    rule_name         = "monthly-12-months"
    target_vault_name = aws_backup_vault.primary.name
    schedule          = "cron(0 4 1 * ? *)"
    lifecycle { delete_after = 365 }
    dynamic "copy_action" {
      for_each = var.enable_dr ? [1] : []
      content {
        destination_vault_arn = aws_backup_vault.dr[0].arn
        lifecycle { delete_after = 365 }
      }
    }
  }
}

data "aws_iam_policy_document" "backup_trust" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["backup.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "backup" {
  name               = "${local.name}-backup"
  assume_role_policy = data.aws_iam_policy_document.backup_trust.json
}

resource "aws_iam_role_policy_attachment" "backup" {
  for_each = toset([
    "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup",
    "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForRestores",
  ])
  role       = aws_iam_role.backup.name
  policy_arn = each.value
}

resource "aws_backup_selection" "aurora" {
  name         = "${local.name}-aurora"
  plan_id      = aws_backup_plan.aurora.id
  iam_role_arn = aws_iam_role.backup.arn
  resources    = [aws_rds_cluster.this.arn]
}
