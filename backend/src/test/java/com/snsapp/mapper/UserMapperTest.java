package com.snsapp.mapper;

import com.snsapp.model.User;
import com.snsapp.model.UserProfile;
import com.snsapp.model.UserSearchResult;
import org.junit.jupiter.api.Test;
import org.mybatis.spring.boot.test.autoconfigure.MybatisTest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 一時的なインメモリSQLite(application-test.propertiesで設定)に対して実際にSQLを実行し、
 * UserMapper.xmlのSQLが本番と同じ方言のまま正しく動くことを検証する。
 */
@MybatisTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class UserMapperTest {

    @Autowired
    private UserMapper userMapper;
    @Autowired
    private FollowMapper followMapper;

    private User insertUser(String username, String email) {
        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
        user.setPasswordHash("hashed");
        userMapper.insert(user);
        return user;
    }

    @Test
    void insertAndFindByEmail_roundTrip() {
        insertUser("alice", "alice@example.com");

        Optional<User> found = userMapper.findByEmail("alice@example.com");

        assertThat(found).isPresent();
        assertThat(found.get().getUsername()).isEqualTo("alice");
        assertThat(found.get().getId()).isNotNull();
    }

    @Test
    void findByUsername_roundTrip() {
        insertUser("bob", "bob@example.com");

        assertThat(userMapper.findByUsername("bob")).isPresent();
        assertThat(userMapper.findByUsername("nobody")).isEmpty();
    }

    @Test
    void findById_roundTrip() {
        User user = insertUser("carol", "carol@example.com");

        Optional<User> found = userMapper.findById(user.getId());

        assertThat(found).isPresent();
        assertThat(found.get().getEmail()).isEqualTo("carol@example.com");
    }

    @Test
    void findProfileById_computesFollowerAndFollowingCountsCorrectly() {
        User alice = insertUser("alice", "alice@example.com");
        User bob = insertUser("bob", "bob@example.com");
        User carol = insertUser("carol", "carol@example.com");

        // bob, carolがaliceをフォロー -> aliceのフォロワーは2人
        followMapper.insert(bob.getId(), alice.getId());
        followMapper.insert(carol.getId(), alice.getId());
        // aliceはbobをフォロー -> aliceのフォロー中は1人
        followMapper.insert(alice.getId(), bob.getId());

        UserProfile profileSeenByBob = userMapper.findProfileById(alice.getId(), bob.getId()).orElseThrow();

        assertThat(profileSeenByBob.getFollowerCount()).isEqualTo(2);
        assertThat(profileSeenByBob.getFollowingCount()).isEqualTo(1);
        assertThat(profileSeenByBob.isFollowedByCurrentUser()).isTrue();

        UserProfile profileSeenByCarolForBob = userMapper.findProfileById(bob.getId(), carol.getId()).orElseThrow();
        assertThat(profileSeenByCarolForBob.isFollowedByCurrentUser()).isFalse();
    }

    @Test
    void updateProfile_withAvatarUrl_updatesAllFields() {
        User user = insertUser("dave", "dave@example.com");

        userMapper.updateProfile(user.getId(), "dave-renamed", "new bio", "/uploads/avatar.jpg");

        UserProfile profile = userMapper.findProfileById(user.getId(), user.getId()).orElseThrow();
        assertThat(profile.getUsername()).isEqualTo("dave-renamed");
        assertThat(profile.getBio()).isEqualTo("new bio");
        assertThat(profile.getAvatarUrl()).isEqualTo("/uploads/avatar.jpg");
    }

    @Test
    void updateProfile_withoutAvatarUrl_preservesExistingAvatarUrl() {
        User user = insertUser("erin", "erin@example.com");
        userMapper.updateProfile(user.getId(), "erin", "first bio", "/uploads/original.jpg");

        // avatarUrlにnullを渡す = アイコンを再アップロードしない編集
        userMapper.updateProfile(user.getId(), "erin", "second bio", null);

        UserProfile profile = userMapper.findProfileById(user.getId(), user.getId()).orElseThrow();
        assertThat(profile.getBio()).isEqualTo("second bio");
        assertThat(profile.getAvatarUrl()).isEqualTo("/uploads/original.jpg");
    }

    @Test
    void search_matchesPartialUsernameAndExcludesSelf() {
        User alice = insertUser("alice", "alice@example.com");
        insertUser("alicia", "alicia@example.com");
        insertUser("bob", "bob@example.com");

        List<UserSearchResult> results = userMapper.search("ali", alice.getId());

        assertThat(results).extracting(UserSearchResult::getUsername).containsExactlyInAnyOrder("alicia");
    }

    @Test
    void search_emptyQuery_returnsAllUsersExceptSelf() {
        User alice = insertUser("alice", "alice@example.com");
        insertUser("bob", "bob@example.com");
        insertUser("carol", "carol@example.com");

        List<UserSearchResult> results = userMapper.search("", alice.getId());

        assertThat(results).extracting(UserSearchResult::getUsername).containsExactlyInAnyOrder("bob", "carol");
    }
}
