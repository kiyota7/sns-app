// シード投入のチューニング値。すべて環境変数で上書き可能。
//
// デフォルトは「ローカルで数分程度で投入し終わる」ことを優先した控えめな規模
// (合計リクエスト数はおおよそ数千件)。より大きなデータ量で試したい場合は
// SEED_USER_COUNT 等を大きくして再実行すればよい(ただし時間もリクエスト数も
// おおむね比例して増える点に注意)。
export const USER_COUNT: number = Number(__ENV.SEED_USER_COUNT) || 50;
export const MIN_POSTS_PER_USER: number = Number(__ENV.SEED_MIN_POSTS) || 3;
export const MAX_POSTS_PER_USER: number = Number(__ENV.SEED_MAX_POSTS) || 8;
export const MIN_COMMENTS_PER_POST: number = Number(__ENV.SEED_MIN_COMMENTS) || 0;
export const MAX_COMMENTS_PER_POST: number = Number(__ENV.SEED_MAX_COMMENTS) || 8;
export const MIN_LIKES_PER_POST: number = Number(__ENV.SEED_MIN_LIKES) || 0;
export const MAX_LIKES_PER_POST: number = Number(__ENV.SEED_MAX_LIKES) || 10;
export const MIN_FOLLOWS_PER_USER: number = Number(__ENV.SEED_MIN_FOLLOWS) || 3;
export const MAX_FOLLOWS_PER_USER: number = Number(__ENV.SEED_MAX_FOLLOWS) || 8;

export const POWER_USER_COUNT: number = Number(__ENV.SEED_POWER_USER_COUNT) || 3;
export const POWER_USER_MIN_POSTS: number = Number(__ENV.SEED_POWER_USER_MIN_POSTS) || 50;
export const POWER_USER_MAX_POSTS: number = Number(__ENV.SEED_POWER_USER_MAX_POSTS) || 100;

// 「バズった投稿」は各パワーユーザーの最初の投稿とし、そこに大量のコメント・
// いいねを集中させる(unbounded-results.ts / write-contention.ts の固定ターゲット)。
// いいねは 1ユーザー1投稿につき最大1回(likesテーブルのUNIQUE制約)なので、
// VIRAL_POST_LIKE_COUNT は総ユーザー数(USER_COUNT + POWER_USER_COUNT)を
// 超えない値にすること。
export const VIRAL_POST_COMMENT_COUNT: number = Number(__ENV.SEED_VIRAL_COMMENTS) || 150;
export const VIRAL_POST_LIKE_COUNT: number = Number(__ENV.SEED_VIRAL_LIKES) || 40;
