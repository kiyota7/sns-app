resource "random_id" "frontend_bucket_suffix" {
  byte_length = 4
}

resource "random_id" "uploads_bucket_suffix" {
  byte_length = 4
}

# --- フロントエンド配信用バケット(非公開) ---
# vue buildの成果物を置くだけのバケットで、CloudFront経由(Origin Access Control)
# 以外からは一切読めないようにする。既存terraform/s3.tfのuploadsバケットのような
# 「誰でも読める」パターンとは異なり、直接のインターネットアクセスは不可。

resource "aws_s3_bucket" "frontend" {
  bucket = "sns-app-fargate-frontend-${random_id.frontend_bucket_suffix.hex}"

  # 学習用途でデータ保全の要件はなく、気軽にインフラを畳めることを優先する
  # (既存terraform/s3.tfと同じ方針)。
  force_destroy = true

  tags = {
    Name = "sns-app-fargate-frontend"
  }
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CloudFrontディストリビューション(cloudfront.tf)からのみ読み取りを許可する。
# AWS:SourceArnで対象ディストリビューションを限定しているため、
# 他のCloudFrontディストリビューションや直接のS3アクセスからは読めない。
data "aws_iam_policy_document" "frontend_cloudfront_read" {
  statement {
    sid       = "AllowCloudFrontServicePrincipalReadOnly"
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.frontend.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.this.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "frontend_cloudfront_read" {
  bucket = aws_s3_bucket.frontend.id
  policy = data.aws_iam_policy_document.frontend_cloudfront_read.json
}

# --- 投稿画像アップロード用バケット(公開読み取り) ---
# 既存terraform/s3.tfのuploadsバケットと同じパターン。EC2構成とは完全に独立させる
# ため(どちらの構成も単独でdestroyできるように)、新規に別バケットとして作成する。

resource "aws_s3_bucket" "uploads" {
  bucket        = "sns-app-fargate-uploads-${random_id.uploads_bucket_suffix.hex}"
  force_destroy = true

  tags = {
    Name = "sns-app-fargate-uploads"
  }
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = false
  restrict_public_buckets = false
}

data "aws_iam_policy_document" "uploads_public_read" {
  statement {
    sid       = "PublicReadGetObject"
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.uploads.arn}/*"]

    principals {
      type        = "AWS"
      identifiers = ["*"]
    }
  }
}

resource "aws_s3_bucket_policy" "uploads_public_read" {
  bucket = aws_s3_bucket.uploads.id
  policy = data.aws_iam_policy_document.uploads_public_read.json

  depends_on = [aws_s3_bucket_public_access_block.uploads]
}

# ECSタスクロール(アプリケーション自身)からのアップロード・削除を許可する。
data "aws_iam_policy_document" "uploads_app_access" {
  statement {
    effect    = "Allow"
    actions   = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.uploads.arn}/*"]
  }
}

resource "aws_iam_role_policy" "uploads_app_access" {
  name   = "sns-app-fargate-uploads-s3-access"
  role   = aws_iam_role.ecs_task.id
  policy = data.aws_iam_policy_document.uploads_app_access.json
}
