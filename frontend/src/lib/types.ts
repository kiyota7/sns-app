// バックエンドの各Response DTO(com.snsapp.dto.*)に対応する型。

export interface User {
  id: number
  username: string
  email: string
  bio: string | null
}

export interface StoredAuth {
  accessToken: string
  refreshToken: string
  user: User
}

export interface Post {
  id: number
  userId: number
  username: string
  body: string
  imageUrl: string | null
  createdAt: string
  updatedAt: string
  likeCount: number
  commentCount: number
  liked: boolean
}

export interface PostPage {
  items: Post[]
  hasMore: boolean
}

export interface Comment {
  id: number
  postId: number
  userId: number
  username: string
  body: string
  createdAt: string
}

export interface Profile {
  id: number
  username: string
  bio: string | null
  avatarUrl: string | null
  followerCount: number
  followingCount: number
  following: boolean
}

export interface UserSearchResult {
  id: number
  username: string
  following: boolean
}

export interface LikeResult {
  liked: boolean
  likeCount: number
}

export interface FollowResult {
  following: boolean
  followerCount: number
}
