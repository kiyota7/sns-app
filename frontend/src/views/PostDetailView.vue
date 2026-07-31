<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { auth, posts, comments, AuthExpiredError } from '../lib/api'
import { formatTime } from '../lib/format'
import PostCard from '../components/PostCard.vue'

const route = useRoute()
const router = useRouter()
const user = ref(auth.getUser())
const post = ref(null)
const commentList = ref([])
const loading = ref(true)
const errorMessage = ref('')

const commentBody = ref('')
const commentSubmitting = ref(false)

onMounted(async () => {
  const postId = route.params.id
  try {
    const [postResult, commentsResult] = await Promise.all([posts.getById(postId), comments.list(postId)])
    post.value = postResult
    commentList.value = commentsResult
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

function handleBack() {
  router.push({ name: 'timeline' })
}

function handlePostUpdated(updated) {
  post.value = updated
}

function handlePostDeleted() {
  router.push({ name: 'timeline' })
}

async function handleCommentSubmit() {
  if (!commentBody.value.trim()) return
  errorMessage.value = ''
  commentSubmitting.value = true
  try {
    const created = await comments.create(route.params.id, { body: commentBody.value })
    commentList.value.unshift(created)
    if (post.value) {
      post.value.commentCount += 1
    }
    commentBody.value = ''
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    commentSubmitting.value = false
  }
}
</script>

<template>
  <header class="app-header">
    <div class="app-header-title">(仮称)SNS</div>
    <nav class="app-header-nav">
      <span class="user-chip">{{ user?.username }}</span>
    </nav>
  </header>

  <div class="page">
    <button type="button" class="back-link" @click="handleBack">← 戻る</button>

    <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
    <p v-else-if="loading">読み込み中...</p>
    <template v-else-if="post">
      <PostCard :post="post" :current-user="user" @updated="handlePostUpdated" @deleted="handlePostDeleted" @error="errorMessage = $event" />

      <form class="comment-form" @submit.prevent="handleCommentSubmit">
        <input type="text" v-model="commentBody" placeholder="コメントを入力" required />
        <button type="submit" class="btn btn-small" :disabled="commentSubmitting">送信</button>
      </form>

      <div v-if="commentList.length === 0" class="empty-state">まだコメントがありません。</div>
      <div v-else>
        <div v-for="comment in commentList" :key="comment.id" class="comment-item">
          <span class="comment-author">{{ comment.username }}</span>
          <span class="post-time">{{ formatTime(comment.createdAt) }}</span>
          <div class="post-body">{{ comment.body }}</div>
        </div>
      </div>
    </template>
  </div>
</template>
