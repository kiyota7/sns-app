package com.snsapp.mapper;

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
class FollowMapperTest {

    @Autowired
    private FollowMapper followMapper;
    @Autowired
    private UserMapper userMapper;

    private Long insertUser(String username) {
        User user = new User();
        user.setUsername(username);
        user.setEmail(username + "@example.com");
        user.setPasswordHash("hashed");
        userMapper.insert(user);
        return user.getId();
    }

    @Test
    void insertAndExistsByFollowerAndFollowed_reflectsInsertedRelation() {
        Long alice = insertUser("alice");
        Long bob = insertUser("bob");

        assertThat(followMapper.existsByFollowerAndFollowed(alice, bob)).isFalse();

        followMapper.insert(alice, bob);

        assertThat(followMapper.existsByFollowerAndFollowed(alice, bob)).isTrue();
        // フォローは片方向であり、逆向きには影響しない
        assertThat(followMapper.existsByFollowerAndFollowed(bob, alice)).isFalse();
    }

    @Test
    void delete_removesOnlyThatRelation() {
        Long alice = insertUser("alice");
        Long bob = insertUser("bob");
        Long carol = insertUser("carol");
        followMapper.insert(alice, bob);
        followMapper.insert(alice, carol);

        followMapper.delete(alice, bob);

        assertThat(followMapper.existsByFollowerAndFollowed(alice, bob)).isFalse();
        assertThat(followMapper.existsByFollowerAndFollowed(alice, carol)).isTrue();
    }
}
