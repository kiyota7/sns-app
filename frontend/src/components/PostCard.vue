<script setup lang="ts">
import { ref } from 'vue'
import { posts } from '../lib/api'
import { getErrorMessage } from '../lib/errors'
import { formatTime } from '../lib/format'
import type { Post, User } from '../lib/types'

const props = defineProps<{
  post: Post
  currentUser?: User | null
}>()

const emit = defineEmits<{
  updated: [post: Post]
  deleted: [postId: number]
  error: [message: string]
}>()

const editing = ref(false)
const editBody = ref('')

const liked = ref(props.post.liked)
const likeCount = ref(props.post.likeCount)
const likeSubmitting = ref(false)

async function toggleLike() {
  if (likeSubmitting.value) return
  likeSubmitting.value = true

  // 楽観的UI更新: サーバーの応答を待たずに見た目を先に反転させ、
  // エラー時はクリック前の状態に戻す。
  const previousLiked = liked.value
  const previousLikeCount = likeCount.value
  liked.value = !previousLiked
  likeCount.value = previousLiked ? previousLikeCount - 1 : previousLikeCount + 1

  try {
    const result = await posts.toggleLike(props.post.id)
    liked.value = result.liked
    likeCount.value = result.likeCount
  } catch (error) {
    liked.value = previousLiked
    likeCount.value = previousLikeCount
    emit('error', getErrorMessage(error))
  } finally {
    likeSubmitting.value = false
  }
}

function startEdit() {
  editBody.value = props.post.body
  editing.value = true
}

function cancelEdit() {
  editing.value = false
}

async function saveEdit() {
  if (!editBody.value.trim()) return
  try {
    const updated = await posts.update(props.post.id, { body: editBody.value })
    emit('updated', updated)
    editing.value = false
  } catch (error) {
    emit('error', getErrorMessage(error))
  }
}

async function handleDelete() {
  if (!confirm('この投稿を削除しますか?')) return
  try {
    await posts.remove(props.post.id)
    emit('deleted', props.post.id)
  } catch (error) {
    emit('error', getErrorMessage(error))
  }
}
</script>

<template>
  <article class="post-card">
    <template v-if="editing">
      <div class="post-card-header">
        <RouterLink class="post-author" :to="`/users/${post.userId}`">{{ post.username }}</RouterLink>
        <span class="post-time">{{ formatTime(post.createdAt) }}</span>
      </div>
      <textarea class="edit-post-textarea" v-model="editBody" rows="3"></textarea>
      <div class="post-actions">
        <button type="button" class="btn btn-small" @click="cancelEdit">キャンセル</button>
        <button type="button" class="btn btn-small btn-outline" @click="saveEdit">保存</button>
      </div>
    </template>
    <template v-else>
      <div class="post-card-header">
        <RouterLink class="post-author" :to="`/users/${post.userId}`">{{ post.username }}</RouterLink>
        <span class="post-time"
          >・{{ formatTime(post.createdAt) }}{{ post.updatedAt !== post.createdAt ? '(編集済み)' : '' }}</span
        >
      </div>
      <div class="post-body">{{ post.body }}</div>
      <img v-if="post.imageUrl" class="image-preview" :src="post.imageUrl" alt="投稿画像" />
      <div class="post-actions">
        <button
          type="button"
          class="action-btn"
          :class="{ liked }"
          :disabled="likeSubmitting"
          :aria-label="liked ? 'いいねを解除' : 'いいね'"
          @click="toggleLike"
        >
          {{ liked ? '♥' : '♡' }} {{ likeCount }}
        </button>
        <RouterLink class="action-btn" :to="`/posts/${post.id}`" aria-label="コメント一覧を見る"
          >💬 {{ post.commentCount }}</RouterLink
        >
        <span v-if="post.userId === currentUser?.id" class="post-owner-menu">
          <button type="button" class="btn btn-small" @click="startEdit">編集</button>
          <button type="button" class="btn btn-small btn-danger" @click="handleDelete">削除</button>
        </span>
      </div>
    </template>
  </article>
</template>
