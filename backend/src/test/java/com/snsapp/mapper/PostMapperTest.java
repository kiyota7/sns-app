package com.snsapp.mapper;

import com.snsapp.model.Comment;
import com.snsapp.model.Post;
import com.snsapp.model.User;
import org.junit.jupiter.api.Test;
import org.mybatis.spring.boot.test.autoconfigure.MybatisTest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@MybatisTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class PostMapperTest {

    @Autowired
    private PostMapper postMapper;
    @Autowired
    private UserMapper userMapper;
    @Autowired
    private LikeMapper likeMapper;
    @Autowired
    private CommentMapper commentMapper;
    @Autowired
    private FollowMapper followMapper;

    private User insertUser(String username) {
        User user = new User();
        user.setUsername(username);
        user.setEmail(username + "@example.com");
        user.setPasswordHash("hashed");
        userMapper.insert(user);
        return user;
    }

    private Post insertPost(Long userId, String body) throws InterruptedException {
        Post post = new Post();
        post.setUserId(userId);
        post.setBody(body);
        postMapper.insert(post);
        // created_atはDB側のstrftime('now')で自動採番されるため、順序検証のため一定間隔を空ける
        Thread.sleep(10);
        return post;
    }

    @Test
    void insertAndFindById_roundTripJoinsAuthorUsername() throws InterruptedException {
        User alice = insertUser("alice");
        Post post = insertPost(alice.getId(), "hello world");

        Post found = postMapper.findById(post.getId(), alice.getId()).orElseThrow();

        assertThat(found.getBody()).isEqualTo("hello world");
        assertThat(found.getUsername()).isEqualTo("alice");
        assertThat(found.getLikeCount()).isZero();
        assertThat(found.getCommentCount()).isZero();
        assertThat(found.isLikedByCurrentUser()).isFalse();
    }

    @Test
    void findById_nonExistentId_returnsEmpty() {
        Optional<Post> found = postMapper.findById(99999L, 1L);

        assertThat(found).isEmpty();
    }

    @Test
    void findAllOrderByCreatedAtDesc_returnsNewestFirst() throws InterruptedException {
        User alice = insertUser("alice");
        Post first = insertPost(alice.getId(), "first");
        Post second = insertPost(alice.getId(), "second");

        List<Post> posts = postMapper.findAllOrderByCreatedAtDesc(alice.getId(), null, 20);

        assertThat(posts).extracting(Post::getId).containsExactly(second.getId(), first.getId());
    }

    @Test
    void findAllOrderByCreatedAtDesc_fetchLimitCapsResultSize() throws InterruptedException {
        User alice = insertUser("alice");
        insertPost(alice.getId(), "first");
        insertPost(alice.getId(), "second");
        insertPost(alice.getId(), "third");

        List<Post> posts = postMapper.findAllOrderByCreatedAtDesc(alice.getId(), null, 2);

        assertThat(posts).hasSize(2);
    }

    @Test
    void findAllOrderByCreatedAtDesc_cursorOnlyReturnsOlderPosts() throws InterruptedException {
        User alice = insertUser("alice");
        Post first = insertPost(alice.getId(), "first");
        Post second = insertPost(alice.getId(), "second");
        Post third = insertPost(alice.getId(), "third");

        List<Post> posts = postMapper.findAllOrderByCreatedAtDesc(alice.getId(), third.getId(), 20);

        assertThat(posts).extracting(Post::getId).containsExactly(second.getId(), first.getId());
    }

    @Test
    void findAllOrderByCreatedAtDesc_aggregatesLikeAndCommentCountsCorrectly() throws InterruptedException {
        User alice = insertUser("alice");
        User bob = insertUser("bob");
        Post post = insertPost(alice.getId(), "popular post");

        likeMapper.insert(post.getId(), alice.getId());
        likeMapper.insert(post.getId(), bob.getId());

        Comment comment = new Comment();
        comment.setPostId(post.getId());
        comment.setUserId(bob.getId());
        comment.setBody("nice!");
        commentMapper.insert(comment);

        Post found = postMapper.findAllOrderByCreatedAtDesc(bob.getId(), null, 20).get(0);

        assertThat(found.getLikeCount()).isEqualTo(2);
        assertThat(found.getCommentCount()).isEqualTo(1);
        assertThat(found.isLikedByCurrentUser()).isTrue();

        Post foundAsAliceFriend = postMapper.findAllOrderByCreatedAtDesc(alice.getId(), null, 20).get(0);
        assertThat(foundAsAliceFriend.isLikedByCurrentUser()).isTrue();
    }

    @Test
    void findFollowingOrderByCreatedAtDesc_onlyReturnsPostsFromFollowedUsers() throws InterruptedException {
        User alice = insertUser("alice");
        User bob = insertUser("bob");
        User carol = insertUser("carol");
        Post bobsPost = insertPost(bob.getId(), "bob's post");
        insertPost(carol.getId(), "carol's post");

        followMapper.insert(alice.getId(), bob.getId());

        List<Post> posts = postMapper.findFollowingOrderByCreatedAtDesc(alice.getId(), null, 20);

        assertThat(posts).extracting(Post::getId).containsExactly(bobsPost.getId());
    }

    @Test
    void findFollowingOrderByCreatedAtDesc_cursorOnlyReturnsOlderPosts() throws InterruptedException {
        User alice = insertUser("alice");
        User bob = insertUser("bob");
        Post first = insertPost(bob.getId(), "first");
        Post second = insertPost(bob.getId(), "second");

        followMapper.insert(alice.getId(), bob.getId());

        List<Post> posts = postMapper.findFollowingOrderByCreatedAtDesc(alice.getId(), second.getId(), 20);

        assertThat(posts).extracting(Post::getId).containsExactly(first.getId());
    }

    @Test
    void findByUserIdOrderByCreatedAtDesc_onlyReturnsThatUsersPosts() throws InterruptedException {
        User alice = insertUser("alice");
        User bob = insertUser("bob");
        insertPost(alice.getId(), "alice post 1");
        insertPost(bob.getId(), "bob post");
        insertPost(alice.getId(), "alice post 2");

        List<Post> posts = postMapper.findByUserIdOrderByCreatedAtDesc(alice.getId(), alice.getId());

        assertThat(posts).hasSize(2);
        assertThat(posts).allMatch(p -> p.getUserId().equals(alice.getId()));
    }

    @Test
    void update_changesBodyAndUpdatedAt() throws InterruptedException {
        User alice = insertUser("alice");
        Post post = insertPost(alice.getId(), "original");

        postMapper.update(post.getId(), "edited");

        Post found = postMapper.findById(post.getId(), alice.getId()).orElseThrow();
        assertThat(found.getBody()).isEqualTo("edited");
    }

    @Test
    void delete_removesPost() throws InterruptedException {
        User alice = insertUser("alice");
        Post post = insertPost(alice.getId(), "to be deleted");

        postMapper.delete(post.getId());

        assertThat(postMapper.findById(post.getId(), alice.getId())).isEmpty();
    }
}
