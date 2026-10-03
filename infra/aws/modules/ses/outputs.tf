output "identity_arn" { value = aws_sesv2_email_identity.domain.arn }
output "configuration_set_name" { value = aws_sesv2_configuration_set.this.configuration_set_name }
output "feedback_queue_arn" { value = aws_sqs_queue.feedback.arn }
output "feedback_queue_url" { value = aws_sqs_queue.feedback.url }
output "feedback_dead_letter_queue_name" { value = aws_sqs_queue.feedback_dead_letter.name }
