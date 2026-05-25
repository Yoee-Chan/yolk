package com.yolk.auth.service;

import com.yolk.auth.AccountUtils;
import com.yolk.auth.mapper.UserMapper;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserMapper userMapper;

    public UserDetailsServiceImpl(UserMapper userMapper) {
        this.userMapper = userMapper;
    }

    @Override
    public UserDetails loadUserByUsername(String account) throws UsernameNotFoundException {
        var entity = (AccountUtils.isEmail(account)
                ? userMapper.findByEmail(account)
                : userMapper.findByPhone(account))
                .orElseThrow(() -> new UsernameNotFoundException("用户不存在"));
        return User.builder()
                .username(account)
                .password(entity.getPasswordHash())
                .roles("USER")
                .build();
    }
}
