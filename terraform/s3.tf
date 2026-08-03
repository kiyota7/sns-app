# 投稿画像の保存先S3バケット。
# S3バケット名はグローバルで一意である必要があるため、ランダムなsuffixを付与して衝突を避ける。
resource "random_id" "uploads_bucket_suffix" {
  byte_length = 4
}

resource "aws_s3_bucket" "uploads" {
  bucket = "sns-app-uploads-${random_id.uploads_bucket_suffix.hex}"

  # オブジェクトが残っていてもterraform destroyできるようにする。
  # 学習用途でデータ保全の要件はなく、taskboard/家計簿アプリ同様、コスト都合で
  # 気軽にインフラを畳めることを優先する。
  force_destroy = true

  tags = {
    Name = "sns-app-uploads"
  }
}

# 投稿画像は現状/uploads/**として認証不要で配信している(nginx経由でEC2ローカルの静的ファイルを配信)
# 仕様と同等の公開範囲にするため、オブジェクトの読み取りのみ全世界に公開する。
# ACLは使わずバケットポリシーのみで完結させるため、ACL経由の公開は塞いだままにする。
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

# EC2(IAMインスタンスプロファイル経由)からのアップロード・削除を許可する。
# バケットを限定した最小権限のみ付与する。
data "aws_iam_policy_document" "uploads_app_access" {
  statement {
    effect    = "Allow"
    actions   = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.uploads.arn}/*"]
  }
}

resource "aws_iam_role_policy" "uploads_app_access" {
  name   = "sns-app-uploads-s3-access"
  role   = aws_iam_role.ec2_ssm.id
  policy = data.aws_iam_policy_document.uploads_app_access.json
}
