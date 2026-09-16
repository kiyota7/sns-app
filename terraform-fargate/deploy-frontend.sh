#!/usr/bin/env bash
# フロントエンド(Vue)をビルドし、S3バケットへ同期、CloudFrontのキャッシュを
# 無効化する。build-and-push.sh(バックエンドのDockerイメージ)とは対象が
# 異なるため別スクリプトにしている。
#
# 前提: 少なくとも一度 `terraform apply` が実行され、S3バケット・
# CloudFrontディストリビューションが存在していること。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

BUCKET="$(terraform output -raw frontend_bucket_name)"
DISTRIBUTION_DOMAIN="$(terraform output -raw cloudfront_domain_name)"
DISTRIBUTION_ID="$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?DomainName=='${DISTRIBUTION_DOMAIN}'].Id" \
  --output text)"

echo "[deploy-frontend] frontendをビルドします..."
(cd "${SCRIPT_DIR}/../frontend" && npm ci && npm run build)

echo "[deploy-frontend] S3バケット ${BUCKET} へ同期します..."
aws s3 sync "${SCRIPT_DIR}/../frontend/dist" "s3://${BUCKET}" --delete

echo "[deploy-frontend] CloudFrontのキャッシュを無効化します(distribution: ${DISTRIBUTION_ID})..."
aws cloudfront create-invalidation --distribution-id "${DISTRIBUTION_ID}" --paths "/*"

echo "[deploy-frontend] 完了: https://${DISTRIBUTION_DOMAIN}"
