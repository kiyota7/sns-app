# 単一のCloudFrontディストリビューションで、フロントエンド(S3)とバックエンドAPI(ALB)を
# 同一ドメインにまとめる。既存EC2構成のnginx.confが /api/ 等だけbackendへ
# リバースプロキシしているのと同じ考え方で、CORS設定を一切不要にしている。
#
# AWSマネージドのキャッシュポリシー/オリジンリクエストポリシーIDを直接参照している
# (全アカウント共通の固定ID。https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-managed-cache-policies.html 参照)。
locals {
  cloudfront_cache_policy_caching_optimized               = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  cloudfront_cache_policy_caching_disabled                = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
  cloudfront_origin_request_policy_all_viewer_except_host = "b689b0a8-53d0-40ab-baf2-68738e2966ac"
}

resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "sns-app-fargate-frontend-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "this" {
  enabled             = true
  default_root_object = "index.html"
  price_class         = "PriceClass_100" # 無料利用枠自体は全PriceClass共通。コスト最小化のため配信対象地域を限定

  origin {
    origin_id                = "frontend-s3"
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  origin {
    origin_id   = "backend-alb"
    domain_name = aws_lb.this.dns_name

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only" # ALBにHTTPSリスナーが無いため(§alb.tf参照)
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # デフォルト動作: フロントエンドの静的アセット(S3)
  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "frontend-s3"
    viewer_protocol_policy = "redirect-to-https"
    cache_policy_id        = local.cloudfront_cache_policy_caching_optimized
  }

  # /api/* ・ /uploads/* ・ Swagger UI関連はALB(バックエンド)へ転送し、キャッシュしない。
  dynamic "ordered_cache_behavior" {
    for_each = [
      "/api/*",
      "/uploads/*",
      "/swagger-ui.html",
      "/swagger-ui/*",
      "/v3/api-docs/*",
    ]
    content {
      path_pattern             = ordered_cache_behavior.value
      allowed_methods          = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
      cached_methods           = ["GET", "HEAD"]
      target_origin_id         = "backend-alb"
      viewer_protocol_policy   = "redirect-to-https"
      cache_policy_id          = local.cloudfront_cache_policy_caching_disabled
      origin_request_policy_id = local.cloudfront_origin_request_policy_all_viewer_except_host
    }
  }

  # SPAのクライアントサイドルーティング対応: S3には/posts/123のようなパスの実体が
  # 無いため403/404になるが、これをindex.htmlへフォールバックさせる
  # (既存frontend/nginx.confの try_files $uri $uri/ /index.html; に相当)。
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # 独自ドメイン/ACM証明書は今回のスコープ外。CloudFrontデフォルトの
  # *.cloudfront.net証明書でHTTPS配信する。
  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Name = "sns-app-fargate-distribution"
  }
}
