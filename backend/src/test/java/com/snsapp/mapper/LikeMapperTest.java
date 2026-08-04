package com.snsapp.mapper;

import com.snsapp.model.Post;
import com.snsapp.model.User;
import org.junit.jupiter.api.Test;
import org.mybatis.spring.boot.test.autoconfigure.MybatisTest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

@MybatisTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class LikeMapperTest {

    @Autowired
    private LikeMapper likeMapper;
    @Autowired
    private UserMapper userMapper;
    @Autowired
    private PostMapper postMapper;

    private Long postId;
    private Long userAId;
    private Long userBId;

    private void setUpUsersAndPost() {
        User userA = new User();
        userA.setUsername("alice");
        userA.setEmail("alice@example.com");
        userA.setPasswordHash("hashed");
        userMapper.insert(userA);
        userAId = userA.getId();

        User userB = new User();
        userB.setUsername("bob");
        userB.setEmail("bob@example.com");
        userB.setPasswordHash("hashed");
        userMapper.insert(userB);
        userBId = userB.getId();

        Post post = new Post();
        post.setUserId(userAId);
        post.setBody("likeable post");
        postMapper.insert(post);
        postId = post.getId();
    }

    @Test
    void insertAndExistsByPostIdAndUserId_reflectsInsertedLike() {
        setUpUsersAndPost();

        assertThat(likeMapper.existsByPostIdAndUserId(postId, userBId)).isFalse();

        likeMapper.insert(postId, userBId);

        assertThat(likeMapper.existsByPostIdAndUserId(postId, userBId)).isTrue();
    }

    @Test
    void countByPostId_countsAllLikesOnThatPost() {
        setUpUsersAndPost();
        likeMapper.insert(postId, userAId);
        likeMapper.insert(postId, userBId);

        assertThat(likeMapper.countByPostId(postId)).isEqualTo(2);
    }

    @Test
    void delete_removesOnlyThatUsersLike() {
        setUpUsersAndPost();
        likeMapper.insert(postId, userAId);
        likeMapper.insert(postId, userBId);

        likeMapper.delete(postId, userAId);

        assertThat(likeMapper.existsByPostIdAndUserId(postId, userAId)).isFalse();
        assertThat(likeMapper.existsByPostIdAndUserId(postId, userBId)).isTrue();
        assertThat(likeMapper.countByPostId(postId)).isEqualTo(1);
    }

    @Test
    void deleteByPostId_removesAllLikesForThatPost() {
        setUpUsersAndPost();
        likeMapper.insert(postId, userAId);
        likeMapper.insert(postId, userBId);

        likeMapper.deleteByPostId(postId);

        assertThat(likeMapper.countByPostId(postId)).isZero();
    }
}
