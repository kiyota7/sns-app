<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { auth, users, AuthExpiredError } from '../lib/api'
import PostCard from '../components/PostCard.vue'

const route = useRoute()
const router = useRouter()
const currentUser = ref(auth.getUser())
const profile = ref(null)
const profilePosts = ref([])
const loading = ref(true)
const errorMessage = ref('')

const editing = ref(false)
const editUsername = ref('')
const editBio = ref('')
const editSubmitting = ref(false)

const followSubmitting = ref(false)

const isSelf = computed(() => profile.value && currentUser.value && profile.value.id === currentUser.value.id)

onMounted(load)

async function load() {
  loading.value = true
  errorMessage.value = ''
  const userId = route.params.id
  try {
    const [profileResult, postsResult] = await Promise.all([users.getProfile(userId), users.getPosts(userId)])
    profile.value = profileResult
    profilePosts.value = postsResult
  } catch (error) {
    if (error instanceof AuthExpiredError) {
      router.push({ name: 'login' })
      return
    }
    errorMessage.value = error.message
  } finally {
    loading.value = false
  }
}

function handleBack() {
  router.push({ name: 'timeline' })
}

function startEdit() {
  editUsername.value = profile.value.username
  editBio.value = profile.value.bio || ''
  editing.value = true
}

function cancelEdit() {
  editing.value = false
}

async function saveEdit() {
  if (!editUsername.value.trim()) return
  errorMessage.value = ''
  editSubmitting.value = true
  try {
    const updated = await users.updateProfile({ username: editUsername.value, bio: editBio.value })
    profile.value = updated
    editing.value = false
    await auth.me()
    currentUser.value = auth.getUser()
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    editSubmitting.value = false
  }
}

async function toggleFollow() {
  if (followSubmitting.value) return
  followSubmitting.value = true
  errorMessage.value = ''
  try {
    const result = await users.toggleFollow(profile.value.id)
    profile.value.following = result.following
    profile.value.followerCount = result.followerCount
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    followSubmitting.value = false
  }
}

function avatarInitial(username) {
  return username ? username.charAt(0).toUpperCase() : '?'
}

function handlePostUpdated(updated) {
  const index = profilePosts.value.findIndex((p) => p.id === updated.id)
  if (index !== -1) {
    profilePosts.value[index] = updated
  }
}

function handlePostDeleted(postId) {
  profilePosts.value = profilePosts.value.filter((p) => p.id !== postId)
}

async function handleLogout() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <header class="app-header">
    <div class="app-header-title">(仮称)SNS</div>
    <nav class="app-header-nav">
      <RouterLink class="user-chip" :to="`/users/${currentUser?.id}`">{{ currentUser?.username }}</RouterLink>
      <button type="button" class="btn btn-outline" @click="handleLogout">ログアウト</button>
    </nav>
  </header>

  <div class="page">
    <button type="button" class="back-link" @click="handleBack">← 戻る</button>

    <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
    <p v-else-if="loading">読み込み中...</p>
    <template v-else-if="profile">
      <div class="profile-header">
        <div class="profile-avatar">{{ avatarInitial(profile.username) }}</div>

        <form v-if="editing" class="profile-edit-form" @submit.prevent="saveEdit">
          <div class="form-row">
            <label for="edit-username">ユーザー名</label>
            <input id="edit-username" v-model="editUsername" type="text" required maxlength="50" />
          </div>
          <div class="form-row">
            <label for="edit-bio">自己紹介</label>
            <textarea id="edit-bio" v-model="editBio" rows="2" maxlength="160"></textarea>
          </div>
          <button type="button" class="btn btn-small" @click="cancelEdit">キャンセル</button>
          <button type="submit" class="btn btn-small btn-outline" :disabled="editSubmitting">保存</button>
        </form>
        <template v-else>
          <div class="profile-username">{{ profile.username }}</div>
          <div class="profile-bio">{{ profile.bio || '(自己紹介はまだありません)' }}</div>
          <div class="profile-stats">
            <span><strong>{{ profile.followingCount }}</strong> フォロー中</span>
            <span><strong>{{ profile.followerCount }}</strong> フォロワー</span>
          </div>
          <div class="profile-actions">
            <button v-if="isSelf" type="button" class="btn btn-outline" @click="startEdit">
              プロフィールを編集
            </button>
            <button
              v-else
              type="button"
              class="btn"
              :class="{ 'btn-outline': profile.following }"
              :disabled="followSubmitting"
              @click="toggleFollow"
            >
              {{ profile.following ? 'フォロー解除' : 'フォローする' }}
            </button>
          </div>
        </template>
      </div>

      <div v-if="profilePosts.length === 0" class="empty-state">まだ投稿がありません。</div>
      <template v-else>
        <PostCard
          v-for="post in profilePosts"
          :key="post.id"
          :post="post"
          :current-user="currentUser"
          @updated="handlePostUpdated"
          @deleted="handlePostDeleted"
          @error="errorMessage = $event"
        />
      </template>
    </template>
  </div>
</template>
