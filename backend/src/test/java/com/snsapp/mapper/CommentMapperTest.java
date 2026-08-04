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

import static org.assertj.core.api.Assertions.assertThat;

@MybatisTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class CommentMapperTest {

    @Autowired
    private CommentMapper commentMapper;
    @Autowired
    private UserMapper userMapper;
    @Autowired
    private PostMapper postMapper;

    private Long userId;
    private Long postId;

    private void setUpUserAndPost() {
        User user = new User();
        user.setUsername("alice");
        user.setEmail("alice@example.com");
        user.setPasswordHash("hashed");
        userMapper.insert(user);
        userId = user.getId();

        Post post = new Post();
        post.setUserId(userId);
        post.setBody("a post to comment on");
        postMapper.insert(post);
        postId = post.getId();
    }

    @Test
    void insertAndFindById_roundTripJoinsAuthorUsername() {
        setUpUserAndPost();
        Comment comment = new Comment();
        comment.setPostId(postId);
        comment.setUserId(userId);
        comment.setBody("nice post!");
        commentMapper.insert(comment);

        Comment found = commentMapper.findById(comment.getId()).orElseThrow();

        assertThat(found.getBody()).isEqualTo("nice post!");
        assertThat(found.getUsername()).isEqualTo("alice");
    }

    @Test
    void findByPostIdOrderByCreatedAtDesc_returnsNewestFirst() throws InterruptedException {
        setUpUserAndPost();
        Comment first = new Comment();
        first.setPostId(postId);
        first.setUserId(userId);
        first.setBody("first comment");
        commentMapper.insert(first);
        Thread.sleep(10);

        Comment second = new Comment();
        second.setPostId(postId);
        second.setUserId(userId);
        second.setBody("second comment");
        commentMapper.insert(second);

        List<Comment> comments = commentMapper.findByPostIdOrderByCreatedAtDesc(postId);

        assertThat(comments).extracting(Comment::getId).containsExactly(second.getId(), first.getId());
    }

    @Test
    void deleteByPostId_removesAllCommentsForThatPost() {
        setUpUserAndPost();
        Comment comment = new Comment();
        comment.setPostId(postId);
        comment.setUserId(userId);
        comment.setBody("will be deleted");
        commentMapper.insert(comment);

        commentMapper.deleteByPostId(postId);

        assertThat(commentMapper.findByPostIdOrderByCreatedAtDesc(postId)).isEmpty();
    }
}
