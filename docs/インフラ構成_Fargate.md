# AWSインフラ構成(ECS Fargate版)

`docs/インフラ構成.md`(EC2 + SQLite構成)とは別の、**EC2を一切使わない**代替インフラ構成。
課題として「ECS Fargate・S3+CloudFront・RDS・ALB」の4サービスを使った構成が指定されており、
両構成は`terraform/`(EC2版)・`terraform-fargate/`(本ドキュメントの対象)としてstateを
完全に分離し、どちらも独立して構築・破棄できる状態を保っている。具体的なリソース定義や
設定値は`terraform-fargate/`ディレクトリのコードを正とするため、ここでは全体像と
運用手順のみを示す。

## 全体構成図

```
[利用者のブラウザ]
        │ HTTPS
        ▼
┌───────────────────────────────────────────────────────┐
│                      CloudFront                        │
│  デフォルト動作(/ 等)          /api/* /uploads/* 等     │
│         │                              │                │
└─────────┼──────────────────────────────┼────────────────┘
          ▼                              ▼
   ┌─────────────┐                ┌─────────────┐
   │  S3バケット   │                │     ALB      │
   │ (フロントエンド │                │  (80番のみ)   │
   │  静的アセット、 │                └──────┬──────┘
   │  非公開・OAC経由│                       ▼
   │  のみ読み取り可)│                ┌─────────────┐
   └─────────────┘                │ ECS Fargate  │
                                    │ タスク(Spot)  │───▶ S3バケット(投稿画像)
                                    │ Spring Boot  │     (公開読み取り。ECSタスク
                                    └──────┬──────┘      ロール経由でPut/Get/Delete)
                                           ▼
                                    ┌─────────────┐
                                    │     RDS      │
                                    │ (PostgreSQL) │
                                    └─────────────┘
```

- フロントエンド(Vueのビルド成果物)はS3バケットに配置し、CloudFront経由でのみ配信する
  (バケット自体は非公開。CloudFront Origin Access Control経由のアクセスのみ許可)
- バックエンド(Spring Boot)はECS Fargate上でコンテナとして稼働する。EC2インスタンスの
  管理は一切不要
- **CloudFrontは単一のディストリビューションで、フロントエンド(S3)とバックエンドAPI
  (ALB)を同一ドメインにまとめている。** `/api/*`・`/uploads/*`・Swagger UI関連のパスだけ
  ALBへ転送し、それ以外はS3(SPAの静的アセット)へ。既存のEC2版がNginxで同じことを
  行っているのと同じ考え方で、**CORS設定が一切不要**になっている
- データベースはRDS(PostgreSQL)。ECS Fargateのタスクはステートレス・エフェメラルな
  実行環境で、再起動・デプロイのたびにローカルディスクの中身が失われるため、EC2版のような
  SQLite(ファイルベース)は使えない。バックエンドには`postgres`プロファイルを追加し、
  既存のSQLite用コードは一切変更していない(`SPRING_PROFILES_ACTIVE=postgres`で切り替え)
- **投稿画像はS3バケットに保存する**(EC2版と同じ考え方だが、両構成の独立性を保つため
  別バケットとして新規作成している)。ECSタスクロール経由でPut/Get/Delete
- ネットワークはEC2版と同じくデフォルトVPCを利用し、NAT Gatewayは作らない。
  ECS FargateタスクはパブリックサブネットにパブリックIP付きで配置するが、セキュリティ
  グループでALBからの通信のみ許可しており、インターネットから直接到達はできない
  (詳細は`terraform-fargate/security.tf`)

## コストを上げないための工夫

課題としてコストを増やさないことも重視しており、以下の設定にしている。

- NAT Gatewayを使わない(ECS Fargateタスクをパブリックサブネット+セキュリティグループ制限で運用)
- ECS Fargateは最小タスクサイズ(0.25 vCPU/0.5GB)・`desired_count=1`・**Fargate Spot**採用
  (オンデマンドの約3割程度のコストで済む。中断が問題になる場合は
  `terraform-fargate/ecs.tf`の`capacity_provider_strategy`を`FARGATE`に変更するだけでよい)
- RDSは`db.t4g.micro`・Single-AZ・最小ストレージ(gp3 20GB)
- JWTシークレット・DBパスワードはAWS Secrets Managerではなく無料のSSM Parameter Store
  (SecureString)で管理
- 何よりも「使わないときは`terraform destroy`で畳む」ことが最大のコスト対策。RDSは
  削除保護なし・最終スナップショットなし、両S3バケットは`force_destroy=true`、
  ECRリポジトリも`force_delete=true`にしており、`terraform destroy`だけで
  クリーンに全リソースを削除できる

## バックエンドのPostgreSQL対応について

EC2版(SQLite)のコードは一切変更せず、追加のみで対応している。

- `backend/pom.xml`にPostgreSQL JDBCドライバ・Flyway PostgreSQL方言サポートを追加
- 新規プロファイル`application-postgres.properties`(`SPRING_PROFILES_ACTIVE=postgres`で有効化)
- 新規マイグレーションディレクトリ`db/migration-postgres/`(既存`db/migration/`のSQLite方言
  ——`AUTOINCREMENT`・`strftime()`——をPostgreSQL方言に移植したもの)
- `PostMapper.xml`/`UserMapper.xml`のUPDATE文にあった`strftime()`呼び出しは、DBに依存しない
  形にするため、Java側(`com.snsapp.util.Timestamps`)で計算したタイムスタンプを
  バインドパラメータとして渡す方式に変更した(SQLite/PostgreSQL両対応の共有コード)

既存のバックエンドテスト(SQLiteプロファイル、123件)には影響がないことを確認済み。
PostgreSQL向けの自動テストは用意しておらず、実際にデプロイしたRDS環境に対して手動で
動作確認する運用としている。

## IaC(Infrastructure as Code)によるコード管理

EC2版と同じく、すべて**Terraform**でコード化して管理しており、マネジメントコンソールの
手動操作は行わない。具体的なリソース定義(インスタンスサイズなどの設定値を含む)は、
今後変更される可能性があるため本ドキュメントには記載せず、`terraform-fargate/`配下の
各`.tf`ファイルを直接参照すること。

## ディレクトリ構成

```
.
├── terraform-fargate/              # インフラのコード化(EC2版terraform/とはstate完全分離)
│   ├── main.tf / variables.tf / outputs.tf
│   ├── network.tf                  # デフォルトVPC/サブネット
│   ├── security.tf                 # ALB/ECSタスク/RDSの3段セキュリティグループ
│   ├── iam.tf                      # ECSタスク実行ロール・タスクロール
│   ├── ssm.tf                      # JWTシークレット・DBパスワード(SSM SecureString)
│   ├── ecr.tf                      # バックエンドイメージ用ECRリポジトリ
│   ├── rds.tf                      # RDS(PostgreSQL)
│   ├── alb.tf                      # ALB
│   ├── ecs.tf                      # ECSクラスタ・タスク定義・サービス(Fargate Spot)
│   ├── s3.tf                       # フロントエンド用(非公開)・uploads用(公開読み取り)バケット
│   ├── cloudfront.tf                # 単一ディストリビューション(S3+ALBオリジン)
│   ├── terraform.tfvars.example
│   ├── build-and-push.sh           # backend Dockerイメージのbuild/ECR push
│   └── deploy-frontend.sh          # frontendビルド+S3同期+CloudFrontキャッシュ無効化
├── backend/src/main/resources/application-postgres.properties
├── backend/src/main/resources/db/migration-postgres/  # PostgreSQL用マイグレーション
└── backend/Dockerfile                                 # EC2版と共通、変更なし
```

## 運用の基本方針

このサンドボックス環境にはAWS認証情報が設定されていないため、Terraformコードの作成・
`terraform validate`までがここで完結している範囲であり、**実際の`terraform apply`は
ユーザー自身が以下の手順で実行する。**

1. `terraform-fargate/terraform.tfvars.example`をコピーして`terraform.tfvars`を作成し、
   `jwt_secret`等を設定する
2. `cd terraform-fargate && terraform init`
3. `terraform apply -target=aws_ecr_repository.backend`(ECRリポジトリを先に作る。
   後続のECSタスク定義が参照するイメージが必要なため)
4. `./build-and-push.sh`(backendのDockerイメージをビルドしてECRへpush)
5. `terraform apply`(フルスタックを構築。ALB・ECS・RDS・CloudFront等)
6. `./deploy-frontend.sh`(frontendをビルドしてS3へ同期、CloudFrontキャッシュを無効化)
7. `terraform output cloudfront_domain_name`で表示されたURLにアクセスし、動作確認する
   - `https://<CloudFrontドメイン>/` でアプリの画面が表示されること
   - `https://<CloudFrontドメイン>/api/auth/me` が401(未認証)を返すこと
     (CloudFront→ALB→ECS→アプリまで正しく繋がっている証拠)
   - 実際に新規登録してみて、RDSへの書き込みまで一連の流れが動くことを確認する
   - うまくいかない場合は `aws logs tail /ecs/sns-app-fargate-backend --follow` で
     バックエンドのログ(Flywayのマイグレーション結果など)を確認する
8. アプリのコードを変更した場合の再デプロイ:
   - バックエンド: `./build-and-push.sh` → 
     `aws ecs update-service --cluster $(terraform output -raw ecs_cluster_name) --service $(terraform output -raw ecs_service_name) --force-new-deployment`
   - フロントエンド: `./deploy-frontend.sh`
9. 環境の削除(コスト停止): `cd terraform-fargate && terraform destroy`
   (RDSのスナップショットは作らない設定のため、データは残らない点に注意)

いずれもAWSマネジメントコンソールやSSHを使わず、AWS CLI/Terraformベースの操作で行う方針は
EC2版と同じ。
