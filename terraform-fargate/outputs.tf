output "aws_region" {
  description = "デプロイ先リージョン(build-and-push.sh / deploy-frontend.shが参照)"
  value       = var.aws_region
}

output "cloudfront_domain_name" {
  description = "アプリへアクセスするためのCloudFrontドメイン(実際のアプリURL)"
  value       = aws_cloudfront_distribution.this.domain_name
}

output "alb_dns_name" {
  description = "ALBのDNS名(バックエンド単体での疎通確認・デバッグ用)"
  value       = aws_lb.this.dns_name
}

output "ecr_repository_url" {
  description = "バックエンドイメージのpush先ECRリポジトリURL(build-and-push.shが参照)"
  value       = aws_ecr_repository.backend.repository_url
}

output "rds_endpoint" {
  description = "RDS(PostgreSQL)のエンドポイント(ホスト:ポート。接続情報自体は非公開情報ではないが、パスワードは別途SSM Parameter Storeを参照)"
  value       = aws_db_instance.this.endpoint
}

output "ecs_cluster_name" {
  description = "ECSクラスタ名"
  value       = aws_ecs_cluster.this.name
}

output "ecs_service_name" {
  description = "ECSサービス名(再デプロイ時のaws ecs update-serviceで指定する)"
  value       = aws_ecs_service.backend.name
}

output "frontend_bucket_name" {
  description = "フロントエンドの静的アセットをアップロードするS3バケット名"
  value       = aws_s3_bucket.frontend.bucket
}

output "cloudwatch_log_group" {
  description = "バックエンドのログが出力されるCloudWatch Logsロググループ名"
  value       = aws_cloudwatch_log_group.backend.name
}
