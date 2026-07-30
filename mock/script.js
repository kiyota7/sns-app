/*
 * (仮称)SNS プロトタイプMock
 *
 * 本物のデータベース・API・認証は一切使用していない。
 * すべてのデータはこのファイル内のJavaScriptオブジェクト(疑似データベース)として保持し、
 * ページを再読み込みしても消えないよう localStorage に保存しているだけである。
 * パスワードも平文のまま保持しており、実際のプロダクトでは絶対に行ってはいけない実装である
 * (このMockはあくまで画面・操作感の確認用)。
 */

const STORAGE_KEY = "sns_mock_state_v1";

function seedState() {
  return {
    nextIds: { user: 5, post: 6, comment: 4, like: 6, follow: 5 },
    currentUserId: null,
    users: [
      { id: 1, username: "たなか", email: "tanaka@example.com", password: "password", bio: "よろしくお願いします。" },
      { id: 2, username: "さとう", email: "sato@example.com", password: "password", bio: "猫が好きです。" },
      { id: 3, username: "すずき", email: "suzuki@example.com", password: "password", bio: "" },
      { id: 4, username: "やまだ", email: "yamada@example.com", password: "password", bio: "エンジニア見習い" },
    ],
    posts: [
      { id: 1, userId: 1, body: "今日は朝から勉強を頑張った。", imageUrl: null, createdAt: "2026-07-30T10:00:00", updatedAt: "2026-07-30T10:00:00" },
      { id: 2, userId: 2, body: "明日から新しい教材を始める予定。", imageUrl: null, createdAt: "2026-07-29T21:00:00", updatedAt: "2026-07-29T21:00:00" },
      { id: 3, userId: 3, body: "猫が椅子の上で寝てる。かわいい。", imageUrl: null, createdAt: "2026-07-29T15:30:00", updatedAt: "2026-07-29T15:30:00" },
      { id: 4, userId: 4, body: "SNSアプリのモックを作ってみた。", imageUrl: null, createdAt: "2026-07-28T18:00:00", updatedAt: "2026-07-28T18:00:00" },
      { id: 5, userId: 1, body: "今日は天気がいいので散歩に行った。", imageUrl: null, createdAt: "2026-07-27T08:00:00", updatedAt: "2026-07-27T08:00:00" },
    ],
    comments: [
      { id: 1, postId: 1, userId: 2, body: "えらい!", createdAt: "2026-07-30T10:15:00" },
      { id: 2, postId: 1, userId: 3, body: "私も頑張ろう", createdAt: "2026-07-30T10:30:00" },
      { id: 3, postId: 3, userId: 1, body: "かわいいですね", createdAt: "2026-07-29T16:00:00" },
    ],
    likes: [
      { id: 1, postId: 1, userId: 2 },
      { id: 2, postId: 1, userId: 3 },
      { id: 3, postId: 1, userId: 4 },
      { id: 4, postId: 3, userId: 1 },
      { id: 5, postId: 2, userId: 1 },
    ],
    follows: [
      { id: 1, followerId: 1, followedId: 2 },
      { id: 2, followerId: 1, followedId: 3 },
      { id: 3, followerId: 2, followedId: 1 },
      { id: 4, followerId: 4, followedId: 1 },
    ],
  };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (e) {
      /* 壊れていた場合はシードし直す */
    }
  }
  return seedState();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

// --- 画面遷移用の状態(データではないのでlocalStorageには保存しない) ---
const nav = {
  view: state.currentUserId ? "timeline" : "login",
  historyStack: [],
  timelineTab: "all",
  viewingPostId: null,
  viewingUserId: null,
  editingPostId: null,
  editingProfile: false,
  composeImageDataUrl: null,
  authError: "",
  searchQuery: "",
};

function goTo(view, extra) {
  if (["timeline", "login", "signup"].includes(view)) {
    nav.historyStack = [];
  } else {
    nav.historyStack.push(nav.view);
  }
  nav.view = view;
  Object.assign(nav, extra || {});
  render();
}

function goBack() {
  const prev = nav.historyStack.pop() || "timeline";
  nav.view = prev;
  render();
}

// --- 疑似データベースへのアクセス関数 ---

function getUser(id) {
  return state.users.find((u) => u.id === id);
}

function getPost(id) {
  return state.posts.find((p) => p.id === id);
}

function likesForPost(postId) {
  return state.likes.filter((l) => l.postId === postId);
}

function commentsForPost(postId) {
  return state.comments
    .filter((c) => c.postId === postId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function isLikedByCurrentUser(postId) {
  return state.likes.some((l) => l.postId === postId && l.userId === state.currentUserId);
}

function followingIdsOf(userId) {
  return state.follows.filter((f) => f.followerId === userId).map((f) => f.followedId);
}

function followerCountOf(userId) {
  return state.follows.filter((f) => f.followedId === userId).length;
}

function followingCountOf(userId) {
  return state.follows.filter((f) => f.followerId === userId).length;
}

function isFollowing(followerId, followedId) {
  return state.follows.some((f) => f.followerId === followerId && f.followedId === followedId);
}

function postsByUser(userId) {
  return state.posts
    .filter((p) => p.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// --- ユーティリティ ---

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function formatTime(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function avatarInitial(username) {
  return (username || "?").charAt(0);
}

// --- レンダリング ---

const appEl = document.getElementById("app");
const headerEl = document.getElementById("app-header");

function render() {
  const loggedIn = !!state.currentUserId;
  headerEl.classList.toggle("hidden", !loggedIn);

  if (loggedIn) {
    const me = getUser(state.currentUserId);
    headerEl.querySelector('[data-action="go-my-profile"]').textContent = me ? me.username : "";
  }

  switch (nav.view) {
    case "login":
      appEl.innerHTML = renderLogin();
      break;
    case "signup":
      appEl.innerHTML = renderSignup();
      break;
    case "timeline":
      appEl.innerHTML = renderTimeline();
      break;
    case "postDetail":
      appEl.innerHTML = renderPostDetail();
      break;
    case "profile":
      appEl.innerHTML = renderProfile();
      break;
    case "search":
      appEl.innerHTML = renderSearch();
      break;
    default:
      appEl.innerHTML = renderTimeline();
  }
}

// S-01 ログイン画面
function renderLogin() {
  return `
    <div class="auth-page">
      <h1>(仮称)SNS</h1>
      <div class="auth-hint">
        デモ用アカウント(すべてパスワード: password)<br>
        tanaka@example.com / sato@example.com / suzuki@example.com / yamada@example.com
      </div>
      ${nav.authError ? `<div class="error-message">${escapeHtml(nav.authError)}</div>` : ""}
      <form data-form="login">
        <div class="form-row">
          <label for="login-email">メールアドレス</label>
          <input id="login-email" name="email" type="email" required />
        </div>
        <div class="form-row">
          <label for="login-password">パスワード</label>
          <input id="login-password" name="password" type="password" required />
        </div>
        <button type="submit" class="btn btn-block">ログイン</button>
      </form>
      <div class="switch-link">
        アカウントをお持ちでない方は <a data-action="go-signup">新規登録</a>
      </div>
    </div>
  `;
}

// S-02 新規登録画面
function renderSignup() {
  return `
    <div class="auth-page">
      <h1>新規登録</h1>
      ${nav.authError ? `<div class="error-message">${escapeHtml(nav.authError)}</div>` : ""}
      <form data-form="signup">
        <div class="form-row">
          <label for="signup-username">ユーザー名</label>
          <input id="signup-username" name="username" type="text" required maxlength="50" />
        </div>
        <div class="form-row">
          <label for="signup-email">メールアドレス</label>
          <input id="signup-email" name="email" type="email" required />
        </div>
        <div class="form-row">
          <label for="signup-password">パスワード</label>
          <input id="signup-password" name="password" type="password" required minlength="4" />
        </div>
        <button type="submit" class="btn btn-block">登録する</button>
      </form>
      <div class="switch-link">
        アカウントをお持ちの方は <a data-action="go-login">ログイン</a>
      </div>
    </div>
  `;
}

// 投稿カード(タイムライン・投稿詳細・プロフィールで共通)
function renderPostCard(post) {
  const author = getUser(post.userId);
  const likeCount = likesForPost(post.id).length;
  const commentCount = commentsForPost(post.id).length;
  const liked = isLikedByCurrentUser(post.id);
  const isOwner = post.userId === state.currentUserId;
  const isEditing = nav.editingPostId === post.id;

  if (isEditing) {
    return `
      <article class="post-card" data-post-id="${post.id}">
        <div class="post-card-header">
          <span class="post-author" data-action="open-profile" data-user-id="${author.id}">${escapeHtml(author.username)}</span>
          <span class="post-time">${formatTime(post.createdAt)}</span>
        </div>
        <textarea class="edit-post-textarea" data-edit-post-id="${post.id}" rows="3">${escapeHtml(post.body)}</textarea>
        <div class="post-actions">
          <button type="button" class="btn btn-small" data-action="cancel-edit-post">キャンセル</button>
          <button type="button" class="btn btn-small btn-outline" data-action="save-edit-post" data-post-id="${post.id}">保存</button>
        </div>
      </article>
    `;
  }

  return `
    <article class="post-card" data-post-id="${post.id}">
      <div class="post-card-header">
        <span class="post-author" data-action="open-profile" data-user-id="${author.id}">${escapeHtml(author.username)}</span>
        <span class="post-time">・${formatTime(post.createdAt)}${post.updatedAt !== post.createdAt ? "(編集済み)" : ""}</span>
      </div>
      <div class="post-body">${escapeHtml(post.body)}</div>
      ${post.imageUrl ? `<img class="image-preview" src="${post.imageUrl}" alt="投稿画像" />` : ""}
      <div class="post-actions">
        <button type="button" class="action-btn ${liked ? "liked" : ""}" data-action="toggle-like" data-post-id="${post.id}">
          ${liked ? "♥" : "♡"} ${likeCount}
        </button>
        <button type="button" class="action-btn" data-action="open-post" data-post-id="${post.id}">
          💬 ${commentCount}
        </button>
        ${
          isOwner
            ? `<span class="post-owner-menu">
                <button type="button" class="btn btn-small" data-action="edit-post" data-post-id="${post.id}">編集</button>
                <button type="button" class="btn btn-small btn-danger" data-action="delete-post" data-post-id="${post.id}">削除</button>
              </span>`
            : ""
        }
      </div>
    </article>
  `;
}

function renderPostList(posts) {
  if (posts.length === 0) {
    return `<div class="empty-state">まだ投稿がありません。</div>`;
  }
  return posts.map(renderPostCard).join("");
}

// S-03 タイムライン画面
function renderTimeline() {
  const allPosts = [...state.posts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const followingIds = followingIdsOf(state.currentUserId);
  const followingPosts = allPosts.filter((p) => followingIds.includes(p.userId));

  const posts = nav.timelineTab === "following" ? followingPosts : allPosts;

  return `
    <div class="page">
      <div class="tabs">
        <button type="button" class="tab-btn ${nav.timelineTab === "all" ? "active" : ""}" data-action="switch-tab" data-tab="all">全体</button>
        <button type="button" class="tab-btn ${nav.timelineTab === "following" ? "active" : ""}" data-action="switch-tab" data-tab="following">フォロー中</button>
      </div>

      <form class="post-form" data-form="compose">
        <textarea name="body" placeholder="いまどうしてる?" rows="2"></textarea>
        ${nav.composeImageDataUrl ? `<img class="image-preview" src="${nav.composeImageDataUrl}" alt="添付画像プレビュー" /><button type="button" class="remove-image-btn" data-action="remove-compose-image">画像を削除</button>` : ""}
        <div class="post-form-footer">
          <label class="btn btn-small btn-outline" style="cursor:pointer;">
            画像添付
            <input type="file" accept="image/*" data-role="compose-image" style="display:none;" />
          </label>
          <button type="submit" class="btn btn-small">投稿</button>
        </div>
      </form>

      ${
        nav.timelineTab === "following" && posts.length === 0
          ? `<div class="empty-state">フォロー中の利用者の投稿がありません。<br>ユーザー検索からフォローしてみましょう。</div>`
          : renderPostList(posts)
      }
    </div>
  `;
}

// S-04 投稿詳細画面
function renderPostDetail() {
  const post = getPost(nav.viewingPostId);
  if (!post) {
    return `<div class="page"><div class="empty-state">投稿が見つかりません。</div></div>`;
  }
  const comments = commentsForPost(post.id);

  return `
    <div class="page">
      <button type="button" class="back-link" data-action="go-back">← 戻る</button>
      ${renderPostCard(post)}
      <form class="comment-form" data-form="comment" data-post-id="${post.id}">
        <input type="text" name="body" placeholder="コメントを入力" required />
        <button type="submit" class="btn btn-small">送信</button>
      </form>
      <div class="comment-list">
        ${
          comments.length === 0
            ? `<div class="empty-state">まだコメントがありません。</div>`
            : comments
                .map((c) => {
                  const author = getUser(c.userId);
                  return `
                    <div class="comment-item">
                      <span class="comment-author" data-action="open-profile" data-user-id="${author.id}">${escapeHtml(author.username)}</span>
                      <span class="post-time">${formatTime(c.createdAt)}</span>
                      <div class="post-body">${escapeHtml(c.body)}</div>
                    </div>
                  `;
                })
                .join("")
        }
      </div>
    </div>
  `;
}

// S-05 プロフィール画面
function renderProfile() {
  const user = getUser(nav.viewingUserId);
  if (!user) {
    return `<div class="page"><div class="empty-state">ユーザーが見つかりません。</div></div>`;
  }
  const isMe = user.id === state.currentUserId;
  const posts = postsByUser(user.id);

  return `
    <div class="page">
      <button type="button" class="back-link" data-action="go-back">← 戻る</button>
      <div class="profile-header">
        <div class="profile-avatar">${escapeHtml(avatarInitial(user.username))}</div>
        ${
          nav.editingProfile && isMe
            ? `
              <form class="profile-edit-form" data-form="edit-profile">
                <div class="form-row">
                  <label for="edit-username">ユーザー名</label>
                  <input id="edit-username" name="username" type="text" value="${escapeHtml(user.username)}" required maxlength="50" />
                </div>
                <div class="form-row">
                  <label for="edit-bio">自己紹介</label>
                  <textarea id="edit-bio" name="bio" rows="2" maxlength="160">${escapeHtml(user.bio || "")}</textarea>
                </div>
                <button type="button" class="btn btn-small" data-action="cancel-edit-profile">キャンセル</button>
                <button type="submit" class="btn btn-small btn-outline">保存</button>
              </form>
            `
            : `
              <div class="profile-username">${escapeHtml(user.username)}</div>
              <div class="profile-bio">${escapeHtml(user.bio || "(自己紹介はまだありません)")}</div>
              <div class="profile-stats">
                <span><strong>${followingCountOf(user.id)}</strong> フォロー中</span>
                <span><strong>${followerCountOf(user.id)}</strong> フォロワー</span>
              </div>
              <div class="profile-actions">
                ${
                  isMe
                    ? `<button type="button" class="btn btn-outline" data-action="edit-profile">プロフィールを編集</button>`
                    : `<button type="button" class="btn ${isFollowing(state.currentUserId, user.id) ? "btn-outline" : ""}" data-action="toggle-follow" data-user-id="${user.id}">
                        ${isFollowing(state.currentUserId, user.id) ? "フォロー解除" : "フォローする"}
                      </button>`
                }
              </div>
            `
        }
      </div>
      ${renderPostList(posts)}
    </div>
  `;
}

// S-06 ユーザー検索画面
function renderSearch() {
  const query = nav.searchQuery.trim();
  const results = query
    ? state.users.filter((u) => u.id !== state.currentUserId && u.username.includes(query))
    : state.users.filter((u) => u.id !== state.currentUserId);

  return `
    <div class="page">
      <button type="button" class="back-link" data-action="go-back">← 戻る</button>
      <form class="search-bar" data-form="search">
        <input type="text" name="query" placeholder="ユーザー名で検索" value="${escapeHtml(nav.searchQuery)}" />
        <button type="submit" class="btn btn-small">検索</button>
      </form>
      ${
        results.length === 0
          ? `<div class="empty-state">該当する利用者が見つかりません。</div>`
          : results
              .map(
                (u) => `
                  <div class="search-result-row">
                    <span class="search-result-name" data-action="open-profile" data-user-id="${u.id}">${escapeHtml(u.username)}</span>
                    <button type="button" class="btn btn-small ${isFollowing(state.currentUserId, u.id) ? "btn-outline" : ""}" data-action="toggle-follow" data-user-id="${u.id}">
                      ${isFollowing(state.currentUserId, u.id) ? "フォロー中" : "フォローする"}
                    </button>
                  </div>
                `
              )
              .join("")
      }
    </div>
  `;
}

// --- イベント処理(イベント委譲。再描画のたびにリスナーを付け直す必要がない) ---

document.addEventListener("click", (e) => {
  const target = e.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;

  switch (action) {
    case "go-login":
      nav.authError = "";
      goTo("login");
      break;
    case "go-signup":
      nav.authError = "";
      goTo("signup");
      break;
    case "go-timeline":
      if (state.currentUserId) goTo("timeline");
      break;
    case "go-search":
      nav.searchQuery = "";
      goTo("search");
      break;
    case "go-my-profile":
      goTo("profile", { viewingUserId: state.currentUserId });
      break;
    case "go-back":
      goBack();
      break;
    case "logout":
      state.currentUserId = null;
      saveState();
      goTo("login");
      break;
    case "switch-tab":
      nav.timelineTab = target.dataset.tab;
      render();
      break;
    case "open-post":
      goTo("postDetail", { viewingPostId: Number(target.dataset.postId) });
      break;
    case "open-profile":
      goTo("profile", { viewingUserId: Number(target.dataset.userId), editingProfile: false });
      break;
    case "toggle-like": {
      const postId = Number(target.dataset.postId);
      const existing = state.likes.find((l) => l.postId === postId && l.userId === state.currentUserId);
      if (existing) {
        state.likes = state.likes.filter((l) => l !== existing);
      } else {
        state.likes.push({ id: state.nextIds.like++, postId, userId: state.currentUserId });
      }
      saveState();
      render();
      break;
    }
    case "edit-post":
      nav.editingPostId = Number(target.dataset.postId);
      render();
      break;
    case "cancel-edit-post":
      nav.editingPostId = null;
      render();
      break;
    case "save-edit-post": {
      const postId = Number(target.dataset.postId);
      const textarea = document.querySelector(`[data-edit-post-id="${postId}"]`);
      const post = getPost(postId);
      if (post && textarea) {
        post.body = textarea.value.trim() || post.body;
        post.updatedAt = new Date().toISOString();
      }
      nav.editingPostId = null;
      saveState();
      render();
      break;
    }
    case "delete-post": {
      const postId = Number(target.dataset.postId);
      if (!confirm("この投稿を削除しますか?コメント・いいねも削除されます。")) break;
      state.posts = state.posts.filter((p) => p.id !== postId);
      state.comments = state.comments.filter((c) => c.postId !== postId);
      state.likes = state.likes.filter((l) => l.postId !== postId);
      saveState();
      if (nav.view === "postDetail") {
        goBack();
      } else {
        render();
      }
      break;
    }
    case "toggle-follow": {
      const userId = Number(target.dataset.userId);
      if (userId === state.currentUserId) break;
      const existing = state.follows.find((f) => f.followerId === state.currentUserId && f.followedId === userId);
      if (existing) {
        state.follows = state.follows.filter((f) => f !== existing);
      } else {
        state.follows.push({ id: state.nextIds.follow++, followerId: state.currentUserId, followedId: userId });
      }
      saveState();
      render();
      break;
    }
    case "edit-profile":
      nav.editingProfile = true;
      render();
      break;
    case "cancel-edit-profile":
      nav.editingProfile = false;
      render();
      break;
    case "remove-compose-image":
      nav.composeImageDataUrl = null;
      render();
      break;
    default:
      break;
  }
});

document.addEventListener("change", (e) => {
  if (e.target.dataset.role === "compose-image") {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      nav.composeImageDataUrl = reader.result;
      render();
    };
    reader.readAsDataURL(file);
  }
});

document.addEventListener("submit", (e) => {
  const form = e.target.closest("[data-form]");
  if (!form) return;
  e.preventDefault();
  const formName = form.dataset.form;
  const data = new FormData(form);

  if (formName === "login") {
    const email = data.get("email").trim().toLowerCase();
    const password = data.get("password");
    const user = state.users.find((u) => u.email.toLowerCase() === email && u.password === password);
    if (!user) {
      nav.authError = "メールアドレスまたはパスワードが正しくありません。";
      render();
      return;
    }
    state.currentUserId = user.id;
    nav.authError = "";
    saveState();
    goTo("timeline");
  }

  if (formName === "signup") {
    const username = data.get("username").trim();
    const email = data.get("email").trim().toLowerCase();
    const password = data.get("password");
    if (state.users.some((u) => u.username === username)) {
      nav.authError = "そのユーザー名は既に使われています。";
      render();
      return;
    }
    if (state.users.some((u) => u.email.toLowerCase() === email)) {
      nav.authError = "そのメールアドレスは既に登録されています。";
      render();
      return;
    }
    const newUser = { id: state.nextIds.user++, username, email, password, bio: "" };
    state.users.push(newUser);
    state.currentUserId = newUser.id;
    nav.authError = "";
    saveState();
    goTo("timeline");
  }

  if (formName === "compose") {
    const body = data.get("body").trim();
    if (!body) return;
    state.posts.push({
      id: state.nextIds.post++,
      userId: state.currentUserId,
      body,
      imageUrl: nav.composeImageDataUrl,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    nav.composeImageDataUrl = null;
    saveState();
    render();
  }

  if (formName === "comment") {
    const postId = Number(form.dataset.postId);
    const body = data.get("body").trim();
    if (!body) return;
    state.comments.push({
      id: state.nextIds.comment++,
      postId,
      userId: state.currentUserId,
      body,
      createdAt: new Date().toISOString(),
    });
    saveState();
    render();
  }

  if (formName === "search") {
    nav.searchQuery = data.get("query") || "";
    render();
  }

  if (formName === "edit-profile") {
    const user = getUser(state.currentUserId);
    user.username = data.get("username").trim() || user.username;
    user.bio = data.get("bio").trim();
    nav.editingProfile = false;
    saveState();
    render();
  }
});

render();
