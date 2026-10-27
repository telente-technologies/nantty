resource "aws_cloudwatch_log_group" "this" {
  count             = local.self_hosted ? 1 : 0
  name              = "/nantty/${var.environment}/livekit"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.logs_kms_key_arn
}

data "aws_iam_policy_document" "ecs_trust" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "execution" {
  count              = local.self_hosted ? 1 : 0
  name               = "${local.name}-exec"
  assume_role_policy = data.aws_iam_policy_document.ecs_trust.json
}

data "aws_iam_policy_document" "execution" {
  count = local.self_hosted ? 1 : 0
  statement {
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.this[0].arn}:*"]
  }
  statement {
    actions   = ["secretsmanager:GetSecretValue", "kms:Decrypt"]
    resources = [aws_secretsmanager_secret.credentials.arn, var.secrets_kms_key_arn]
  }
}

resource "aws_iam_role_policy" "execution" {
  count  = local.self_hosted ? 1 : 0
  role   = aws_iam_role.execution[0].id
  policy = data.aws_iam_policy_document.execution[0].json
}

resource "aws_lb_target_group" "signal" {
  count       = local.self_hosted ? 1 : 0
  name        = "${var.environment}-livekit"
  vpc_id      = var.vpc_id
  port        = 7880
  protocol    = "HTTP"
  target_type = "instance"
  health_check {
    path    = "/"
    matcher = "200"
  }
}

resource "aws_lb_listener_rule" "signal" {
  count        = local.self_hosted ? 1 : 0
  listener_arn = var.listener_arn
  priority     = 30
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.signal[0].arn
  }
  condition {
    host_header { values = [var.host] }
  }
}

resource "aws_ecs_task_definition" "this" {
  count                    = local.self_hosted ? 1 : 0
  family                   = local.name
  requires_compatibilities = ["EC2"]
  network_mode             = "host"
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = aws_iam_role.execution[0].arn
  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }
  container_definitions = jsonencode([{
    name      = "livekit"
    image     = var.image
    essential = true
    secrets   = [{ name = "LIVEKIT_CONFIG", valueFrom = "${aws_secretsmanager_secret.credentials.arn}:LIVEKIT_CONFIG::" }]
    logConfiguration = {
      logDriver = "awslogs"
      options   = { "awslogs-group" = aws_cloudwatch_log_group.this[0].name, "awslogs-region" = var.region, "awslogs-stream-prefix" = "livekit" }
    }
  }])
}

resource "aws_ecs_service" "this" {
  count           = local.self_hosted ? 1 : 0
  name            = "livekit"
  cluster         = var.cluster_arn
  task_definition = aws_ecs_task_definition.this[0].arn
  desired_count   = var.node_count
  capacity_provider_strategy {
    capacity_provider = aws_ecs_capacity_provider.node[0].name
    weight            = 1
  }
  ordered_placement_strategy {
    type  = "spread"
    field = "attribute:ecs.availability-zone"
  }
  placement_constraints { type = "distinctInstance" }
  load_balancer {
    target_group_arn = aws_lb_target_group.signal[0].arn
    container_name   = "livekit"
    container_port   = 7880
  }
  depends_on = [aws_lb_listener_rule.signal]
}
