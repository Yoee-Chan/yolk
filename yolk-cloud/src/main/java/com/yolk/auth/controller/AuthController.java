package com.yolk.auth.controller;

import com.yolk.auth.AuthUtils;
import com.yolk.auth.dto.AuthDtos;
import com.yolk.auth.service.AuthService;
import com.yolk.common.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public ApiResponse<AuthDtos.AuthResponse> register(@Valid @RequestBody AuthDtos.RegisterRequest request) {
        return ApiResponse.ok(authService.register(request));
    }

    @PostMapping("/login")
    public ApiResponse<AuthDtos.AuthResponse> login(@Valid @RequestBody AuthDtos.LoginRequest request) {
        return ApiResponse.ok(authService.login(request));
    }

    @GetMapping("/me")
    public ApiResponse<AuthDtos.UserProfile> me() {
        return ApiResponse.ok(authService.getProfile(AuthUtils.currentUserId()));
    }

    @PutMapping("/profile")
    public ApiResponse<AuthDtos.UserProfile> updateProfile(@Valid @RequestBody AuthDtos.UpdateProfileRequest request) {
        return ApiResponse.ok(authService.updateProfile(AuthUtils.currentUserId(), request));
    }

    @PutMapping("/password")
    public ApiResponse<Void> updatePassword(@Valid @RequestBody AuthDtos.UpdatePasswordRequest request) {
        authService.updatePassword(AuthUtils.currentUserId(), request);
        return ApiResponse.ok();
    }
}
