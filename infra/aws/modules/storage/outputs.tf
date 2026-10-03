output "media_bucket" { value = { id = aws_s3_bucket.media.id, arn = aws_s3_bucket.media.arn } }
output "kyc_bucket" { value = { id = aws_s3_bucket.kyc.id, arn = aws_s3_bucket.kyc.arn } }
output "logs_bucket" { value = { id = aws_s3_bucket.logs.id, arn = aws_s3_bucket.logs.arn } }
output "media_distribution_id" { value = aws_cloudfront_distribution.media.id }
output "media_distribution_domain_name" { value = aws_cloudfront_distribution.media.domain_name }
output "media_distribution_zone_id" { value = aws_cloudfront_distribution.media.hosted_zone_id }
output "media_key_group_id" { value = try(aws_cloudfront_key_group.media_signing[0].id, null) }
