<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { auth, posts, AuthExpiredError } from '../lib/api'
import PostCard from '../components/PostCard.vue'

const router = useRouter()
const user = ref(auth.getUser())
const postList = ref([])
const loading = ref(true)
const errorMessage = ref('')

const composeBody = ref('')
const composeImageFile = ref(null)
const composeImagePreview = ref('')
const composeSubmitting = ref(false)
const fileInput = ref(null)

onMounted(async () => {
  try {
    postList.value = await posts.list()
  } catch (error) {
    if (error instanceof AuthExpiredError) {
      router.push({ name: 'login' })
      return
    }
    errorMessage.value = error.message
  } finally {
    loading.value = false
  }
})

function handleImageChange(event) {
  const file = event.target.files[0]
  if (!file) return
  composeImageFile.value = file
  const reader = new FileReader()
  reader.onload = () => {
    composeImagePreview.value = reader.result
  }
  reader.readAsDataURL(file)
}

function removeComposeImage() {
  composeImageFile.value = null
  composeImagePreview.value = ''
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

async function handleCompose() {
  if (!composeBody.value.trim()) return
  errorMessage.value = ''
  composeSubmitting.value = true
  try {
    const created = await posts.create({ body: composeBody.value, image: composeImageFile.value })
    postList.value.unshift(created)
    composeBody.value = ''
    removeComposeImage()
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    composeSubmitting.value = false
  }
}

function handlePostUpdated(updated) {
  const index = postList.value.findIndex((p) => p.id === updated.id)
  if (index !== -1) {
    postList.value[index] = updated
  }
}

function handlePostDeleted(postId) {
  postList.value = postList.value.filter((p) => p.id !== postId)
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
      <span class="user-chip">{{ user?.username }}</span>
      <button type="button" class="btn btn-outline" @click="handleLogout">ログアウト</button>
    </nav>
  </header>

  <div class="page">
    <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>

    <form class="post-form" @submit.prevent="handleCompose">
      <textarea v-model="composeBody" placeholder="いまどうしてる?" rows="2"></textarea>
      <img v-if="composeImagePreview" class="image-preview" :src="composeImagePreview" alt="添付画像プレビュー" />
      <button v-if="composeImagePreview" type="button" class="remove-image-btn" @click="removeComposeImage">
        画像を削除
      </button>
      <div class="post-form-footer">
        <label class="btn btn-small btn-outline" style="cursor: pointer">
          画像添付
          <input ref="fileInput" type="file" accept="image/*" style="display: none" @change="handleImageChange" />
        </label>
        <button type="submit" class="btn btn-small" :disabled="composeSubmitting">投稿</button>
      </div>
    </form>

    <p v-if="loading">読み込み中...</p>
    <div v-else-if="postList.length === 0" class="empty-state">まだ投稿がありません。</div>
    <template v-else>
      <PostCard
        v-for="post in postList"
        :key="post.id"
        :post="post"
        :current-user="user"
        @updated="handlePostUpdated"
        @deleted="handlePostDeleted"
        @error="errorMessage = $event"
      />
    </template>
  </div>
</template>
