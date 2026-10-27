terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.70" }
  }
}

data "aws_caller_identity" "current" {}

locals {
  family  = "nantty-${var.environment}-${var.name}"
  has_lb  = length(var.listener_rules) > 0
  rules   = { for rule in var.listener_rules : "${rule.listener_arn}:${rule.priority}" => rule }
  app_env = merge({ OTEL_EXPORTER_OTLP_ENDPOINT = "http://127.0.0.1:4318" }, var.environment_variables, { OTEL_SERVICE_NAME = var.name, OTEL_RESOURCE_ATTRIBUTES = "deployment.environment=${var.environment}", ENVIRONMENT = var.environment })
  scrape  = var.otel_sidecar && var.metrics_scrape_path != null
  collector_config = yamlencode({
    receivers = merge(
      { otlp = { protocols = { grpc = { endpoint = "127.0.0.1:4317" }, http = { endpoint = "127.0.0.1:4318" } } } },
      local.scrape ? { prometheus = { config = { scrape_configs = [{
        job_name        = var.name
        scrape_interval = "60s"
        scrape_timeout  = "5s"
        metrics_path    = var.metrics_scrape_path
        static_configs  = [{ targets = ["127.0.0.1:${var.port}"], labels = { service = var.name } }]
      }] } } } : {},
    )
    processors = { batch = {} }
    exporters = {
      awsxray = { region = var.region }
      awsemf = {
        region                           = var.region
        namespace                        = "Nantty/${var.environment}"
        log_group_name                   = "/nantty/${var.environment}/${var.name}/metrics"
        log_stream_name                  = "{TaskId}"
        resource_to_telemetry_conversion = { enabled = true }
        metric_declarations = [
          { dimensions = [["service"]], metric_name_selectors = ["^go_goroutines$", "^auth_session_denylist_.*", "^realtime_socket_connected_total$", "^vm_memory_total_bytes$"] },
          { dimensions = [["service", "status_class"], ["service"]], metric_name_selectors = ["^http_server_request_duration_seconds.*"] },
          { dimensions = [["service.name", "http.response.status_code"], ["service.name"]], metric_name_selectors = ["^http\\.server\\.request\\.duration$"] },
        ]
      }
    }
    service = {
      pipelines = merge(
        { traces = { receivers = ["otlp"], processors = ["batch"], exporters = ["awsxray"] } },
        { metrics = { receivers = local.scrape ? ["otlp", "prometheus"] : ["otlp"], processors = ["batch"], exporters = ["awsemf"] } },
      )
    }
  })
  tg_pair      = var.blue_green ? ["blue", "green"] : ["blue"]
  port_mapping = [for port in concat([var.port], var.extra_ports) : { containerPort = port, hostPort = port, protocol = "tcp" }]
}

resource "aws_cloudwatch_log_group" "metrics" {
  count             = var.otel_sidecar ? 1 : 0
  name              = "/nantty/${var.environment}/${var.name}/metrics"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.logs_kms_key_arn
}

resource "aws_cloudwatch_log_group" "this" {
  name              = "/nantty/${var.environment}/${var.name}"
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
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

resource "aws_iam_role" "execution" {
  name               = "${local.family}-exec"
  assume_role_policy = data.aws_iam_policy_document.ecs_trust.json
}

data "aws_iam_policy_document" "execution" {
  statement {
    sid       = "PullOwnImage"
    actions   = ["ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer", "ecr:BatchCheckLayerAvailability"]
    resources = ["arn:aws:ecr:${var.region}:${data.aws_caller_identity.current.account_id}:repository/nantty/${var.name}"]
  }
  statement {
    sid       = "EcrAuthToken"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }
  statement {
    sid       = "WriteOwnLogs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.this.arn}:*"]
  }
  dynamic "statement" {
    for_each = length(var.secret_arns) > 0 ? [1] : []
    content {
      sid       = "ReadOwnSecrets"
      actions   = ["secretsmanager:GetSecretValue"]
      resources = var.secret_arns
    }
  }
  statement {
    sid       = "DecryptSecrets"
    actions   = ["kms:Decrypt"]
    resources = [var.secrets_kms_key_arn]
  }
}

resource "aws_iam_role_policy" "execution" {
  role   = aws_iam_role.execution.id
  policy = data.aws_iam_policy_document.execution.json
}

resource "aws_iam_role" "task" {
  name               = "${local.family}-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_trust.json
}

data "aws_iam_policy_document" "task" {
  statement {
    sid       = "TraceExport"
    actions   = ["xray:PutTraceSegments", "xray:PutTelemetryRecords", "xray:GetSamplingRules", "xray:GetSamplingTargets"]
    resources = ["*"]
  }
  statement {
    sid       = "OwnMetrics"
    actions   = ["cloudwatch:PutMetricData"]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "cloudwatch:namespace"
      values   = ["Nantty/${var.environment}"]
    }
  }
  dynamic "statement" {
    for_each = var.otel_sidecar ? [1] : []
    content {
      sid       = "EmbeddedMetricLogs"
      actions   = ["logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogStreams", "logs:DescribeLogGroups"]
      resources = [aws_cloudwatch_log_group.metrics[0].arn, "${aws_cloudwatch_log_group.metrics[0].arn}:*"]
    }
  }
  dynamic "statement" {
    for_each = var.enable_execute_command ? [1] : []
    content {
      sid       = "EcsExec"
      actions   = ["ssmmessages:CreateControlChannel", "ssmmessages:CreateDataChannel", "ssmmessages:OpenControlChannel", "ssmmessages:OpenDataChannel"]
      resources = ["*"]
    }
  }
  dynamic "statement" {
    for_each = var.task_policy_statements
    content {
      sid       = statement.value.sid
      actions   = statement.value.actions
      resources = statement.value.resources
      dynamic "condition" {
        for_each = statement.value.conditions
        content {
          test     = condition.value.test
          variable = condition.value.variable
          values   = condition.value.values
        }
      }
    }
  }
}

resource "aws_iam_role_policy" "task" {
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.task.json
}

resource "aws_ecs_task_definition" "this" {
  family                   = local.family
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = var.cpu_architecture
  }

  volume { name = "tmp" }

  container_definitions = jsonencode(concat([
    merge({
      name                   = var.name
      image                  = "${var.image}:${var.image_tag}"
      essential              = true
      readonlyRootFilesystem = var.readonly_root_filesystem
      stopTimeout            = 30
      portMappings           = local.port_mapping
      environment            = [for key, value in local.app_env : { name = key, value = value }]
      secrets                = [for key, value in var.secrets : { name = key, valueFrom = value }]
      mountPoints            = [{ sourceVolume = "tmp", containerPath = "/tmp", readOnly = false }]
      linuxParameters        = { initProcessEnabled = true, capabilities = { drop = ["ALL"] } }
      ulimits                = [{ name = "nofile", softLimit = 65536, hardLimit = 65536 }]
      dependsOn              = var.otel_sidecar ? [{ containerName = "otel-collector", condition = "START" }] : []
      logConfiguration = {
        logDriver = "awslogs"
        options   = { "awslogs-group" = aws_cloudwatch_log_group.this.name, "awslogs-region" = var.region, "awslogs-stream-prefix" = var.name }
      }
      }, var.container_health_check == null ? {} : {
      healthCheck = { command = var.container_health_check, interval = 15, timeout = 5, retries = 3, startPeriod = 30 }
    }),
    ], var.otel_sidecar ? [{
      name                   = "otel-collector"
      image                  = var.otel_collector_image
      essential              = false
      readonlyRootFilesystem = false
      cpu                    = 0
      portMappings           = [{ containerPort = 4318, hostPort = 4318, protocol = "tcp" }]
      environment            = [{ name = "AOT_CONFIG_CONTENT", value = local.collector_config }]
      logConfiguration = {
        logDriver = "awslogs"
        options   = { "awslogs-group" = aws_cloudwatch_log_group.this.name, "awslogs-region" = var.region, "awslogs-stream-prefix" = "otel" }
      }
  }] : []))
}

resource "aws_lb_target_group" "this" {
  for_each             = local.has_lb ? toset(local.tg_pair) : toset([])
  name                 = substr("${var.environment}-${var.name}-${each.key}", 0, 32)
  vpc_id               = var.vpc_id
  port                 = var.port
  protocol             = "HTTP"
  target_type          = "ip"
  deregistration_delay = var.deregistration_delay
  health_check {
    path                = var.health_path
    matcher             = "200"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
  lifecycle { create_before_destroy = true }
}

resource "aws_lb_listener_rule" "this" {
  for_each     = local.rules
  listener_arn = each.value.listener_arn
  priority     = each.value.priority
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.this["blue"].arn
  }
  dynamic "condition" {
    for_each = length(each.value.path_patterns) > 0 ? [1] : []
    content {
      path_pattern { values = each.value.path_patterns }
    }
  }
  dynamic "condition" {
    for_each = length(each.value.host_headers) > 0 ? [1] : []
    content {
      host_header { values = each.value.host_headers }
    }
  }
  lifecycle { ignore_changes = [action] }
}

resource "aws_service_discovery_service" "this" {
  name = var.name
  dns_config {
    namespace_id   = var.namespace_id
    routing_policy = "MULTIVALUE"
    dns_records {
      ttl  = 10
      type = "A"
    }
  }
  health_check_custom_config { failure_threshold = 1 }
}

resource "aws_ecs_service" "this" {
  name                               = var.name
  cluster                            = var.cluster_arn
  task_definition                    = aws_ecs_task_definition.this.arn
  desired_count                      = var.desired_count
  enable_execute_command             = var.enable_execute_command
  health_check_grace_period_seconds  = local.has_lb ? 60 : null
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
  propagate_tags                     = "SERVICE"

  dynamic "capacity_provider_strategy" {
    for_each = var.use_spot ? [1] : []
    content {
      capacity_provider = "FARGATE_SPOT"
      weight            = 1
    }
  }

  dynamic "capacity_provider_strategy" {
    for_each = var.use_spot ? [] : [1]
    content {
      capacity_provider = "FARGATE"
      weight            = 1
    }
  }

  deployment_controller {
    type = var.blue_green ? "CODE_DEPLOY" : "ECS"
  }

  dynamic "deployment_circuit_breaker" {
    for_each = var.blue_green ? [] : [1]
    content {
      enable   = true
      rollback = true
    }
  }

  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = var.security_group_ids
    assign_public_ip = false
  }

  dynamic "load_balancer" {
    for_each = local.has_lb ? [1] : []
    content {
      target_group_arn = aws_lb_target_group.this["blue"].arn
      container_name   = var.name
      container_port   = var.port
    }
  }

  service_registries {
    registry_arn = aws_service_discovery_service.this.arn
  }

  depends_on = [aws_lb_listener_rule.this]

  lifecycle {
    ignore_changes = [task_definition, desired_count, load_balancer, network_configuration[0].assign_public_ip]
  }
}

resource "aws_appautoscaling_target" "this" {
  service_namespace  = "ecs"
  scalable_dimension = "ecs:service:DesiredCount"
  resource_id        = "service/${var.cluster_name}/${aws_ecs_service.this.name}"
  min_capacity       = var.min_count
  max_capacity       = var.max_count
}

resource "aws_appautoscaling_policy" "cpu" {
  name               = "${local.family}-cpu"
  policy_type        = "TargetTrackingScaling"
  service_namespace  = aws_appautoscaling_target.this.service_namespace
  scalable_dimension = aws_appautoscaling_target.this.scalable_dimension
  resource_id        = aws_appautoscaling_target.this.resource_id
  target_tracking_scaling_policy_configuration {
    target_value       = var.cpu_target_percent
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
    predefined_metric_specification { predefined_metric_type = "ECSServiceAverageCPUUtilization" }
  }
}

resource "aws_appautoscaling_policy" "memory" {
  name               = "${local.family}-memory"
  policy_type        = "TargetTrackingScaling"
  service_namespace  = aws_appautoscaling_target.this.service_namespace
  scalable_dimension = aws_appautoscaling_target.this.scalable_dimension
  resource_id        = aws_appautoscaling_target.this.resource_id
  target_tracking_scaling_policy_configuration {
    target_value       = var.memory_target_percent
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
    predefined_metric_specification { predefined_metric_type = "ECSServiceAverageMemoryUtilization" }
  }
}

resource "aws_appautoscaling_policy" "requests" {
  count              = local.has_lb && var.request_count_target > 0 ? 1 : 0
  name               = "${local.family}-requests"
  policy_type        = "TargetTrackingScaling"
  service_namespace  = aws_appautoscaling_target.this.service_namespace
  scalable_dimension = aws_appautoscaling_target.this.scalable_dimension
  resource_id        = aws_appautoscaling_target.this.resource_id
  target_tracking_scaling_policy_configuration {
    target_value       = var.request_count_target
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
    predefined_metric_specification {
      predefined_metric_type = "ALBRequestCountPerTarget"
      resource_label         = "${var.alb_arn_suffix}/${aws_lb_target_group.this["blue"].arn_suffix}"
    }
  }
}
