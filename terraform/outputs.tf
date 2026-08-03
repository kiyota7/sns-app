output "instance_id" {
  description = "EC2インスタンスID(aws ssm send-command等で使用)"
  value       = aws_instance.app.id
}

output "public_ip" {
  description = "アプリへアクセスするためのElastic IP"
  value       = aws_eip.app.public_ip
}

output "s3_bucket_name" {
  description = "投稿画像を保存するS3バケット名"
  value       = aws_s3_bucket.uploads.bucket
}
