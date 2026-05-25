package com.yolk.auth.service;

import com.yolk.auth.AccountUtils;
import com.yolk.auth.dto.AuthDtos;
import com.yolk.auth.entity.UserEntity;
import com.yolk.auth.mapper.UserMapper;
import com.yolk.common.BusinessException;
import com.yolk.config.JwtService;
import com.yolk.traffic.entity.UserTrafficEntity;
import com.yolk.traffic.mapper.TrafficPlanMapper;
import com.yolk.traffic.mapper.UserTrafficMapper;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Service
public class AuthService {

    private static final String DEFAULT_PLAN_ID = "pro";
    private static final int MAX_AVATAR_LENGTH = 500_000;

    private final UserMapper userMapper;
    private final UserTrafficMapper userTrafficMapper;
    private final TrafficPlanMapper trafficPlanMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;

    public AuthService(UserMapper userMapper,
                       UserTrafficMapper userTrafficMapper,
                       TrafficPlanMapper trafficPlanMapper,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService,
                       AuthenticationManager authenticationManager) {
        this.userMapper = userMapper;
        this.userTrafficMapper = userTrafficMapper;
        this.trafficPlanMapper = trafficPlanMapper;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.authenticationManager = authenticationManager;
    }

    @Transactional
    public AuthDtos.AuthResponse register(AuthDtos.RegisterRequest request) {
        String email = request.email() != null ? request.email().trim() : null;
        String phone = request.phone() != null ? request.phone().trim() : null;
        AccountUtils.requireEmailOrPhone(email, phone);

        if (email != null && !email.isBlank()) {
            if (userMapper.existsByEmail(email)) {
                throw new BusinessException(400, "邮箱已被注册");
            }
        }
        if (phone != null && !phone.isBlank()) {
            if (userMapper.existsByPhone(phone)) {
                throw new BusinessException(400, "手机号已被注册");
            }
        }

        var plan = trafficPlanMapper.findById(DEFAULT_PLAN_ID)
                .orElseThrow(() -> new BusinessException(500, "默认套餐未配置"));

        var user = new UserEntity();
        user.setEmail(email != null && !email.isBlank() ? email : null);
        user.setPhone(phone != null && !phone.isBlank() ? phone : null);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setNickname(resolveNickname(request.nickname(), email, phone));
        user.setCreatedAt(LocalDateTime.now());
        userMapper.insert(user);

        var traffic = new UserTrafficEntity();
        traffic.setUserId(user.getId());
        traffic.setPlanId(plan.getId());
        traffic.setTotalTokens(plan.getTotalTokens());
        traffic.setUsedTokens(0L);
        traffic.setRenewDate(LocalDate.now().plusMonths(1));
        traffic.setDailyLimit(80_000L);
        userTrafficMapper.insert(traffic);

        return buildAuthResponse(user);
    }

    public AuthDtos.AuthResponse login(AuthDtos.LoginRequest request) {
        String account = AccountUtils.loginKey(request.account());
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(account, request.password()));
        var user = findByAccount(account)
                .orElseThrow(() -> new BusinessException(401, "用户不存在"));
        return buildAuthResponse(user);
    }

    public AuthDtos.UserProfile getProfile(Long userId) {
        var user = userMapper.findById(userId)
                .orElseThrow(() -> new BusinessException(404, "用户不存在"));
        return toProfile(user);
    }

    @Transactional
    public AuthDtos.UserProfile updateProfile(Long userId, AuthDtos.UpdateProfileRequest request) {
        var user = userMapper.findById(userId)
                .orElseThrow(() -> new BusinessException(404, "用户不存在"));
        if (request.nickname() != null) {
            String nickname = request.nickname().trim();
            if (nickname.isEmpty()) {
                throw new BusinessException(400, "用户名不能为空");
            }
            user.setNickname(nickname);
        }
        if (request.avatarUrl() != null) {
            if (request.avatarUrl().length() > MAX_AVATAR_LENGTH) {
                throw new BusinessException(400, "头像数据过大");
            }
            user.setAvatarUrl(request.avatarUrl().isBlank() ? null : request.avatarUrl());
        }
        userMapper.update(user);
        return toProfile(user);
    }

    @Transactional
    public void updatePassword(Long userId, AuthDtos.UpdatePasswordRequest request) {
        var user = userMapper.findById(userId)
                .orElseThrow(() -> new BusinessException(404, "用户不存在"));
        if (!passwordEncoder.matches(request.oldPassword(), user.getPasswordHash())) {
            throw new BusinessException(400, "原密码不正确");
        }
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        userMapper.update(user);
    }

    public java.util.Optional<UserEntity> findByAccount(String account) {
        if (AccountUtils.isEmail(account)) {
            return userMapper.findByEmail(account);
        }
        return userMapper.findByPhone(account);
    }

    private String resolveNickname(String nickname, String email, String phone) {
        if (nickname != null && !nickname.isBlank()) {
            return nickname.trim();
        }
        if (email != null && !email.isBlank()) {
            return email.split("@")[0];
        }
        if (phone != null && !phone.isBlank()) {
            return "用户" + phone.substring(phone.length() - 4);
        }
        return "Yolk用户";
    }

    private AuthDtos.AuthResponse buildAuthResponse(UserEntity user) {
        String loginName = user.getEmail() != null ? user.getEmail()
                : (user.getPhone() != null ? user.getPhone() : String.valueOf(user.getId()));
        String token = jwtService.generateToken(user.getId(), loginName);
        return new AuthDtos.AuthResponse(token, toProfile(user));
    }

    private AuthDtos.UserProfile toProfile(UserEntity user) {
        return new AuthDtos.UserProfile(
                user.getId(),
                user.getEmail(),
                user.getPhone(),
                user.getNickname(),
                user.getAvatarUrl()
        );
    }
}
