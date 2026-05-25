package com.yolk.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class AuthDtos {

    private AuthDtos() {}

    public record RegisterRequest(
            String email,
            String phone,
            @NotBlank @Size(min = 6, max = 64) String password,
            @Size(max = 64) String nickname
    ) {}

    public record LoginRequest(
            @NotBlank String account,
            @NotBlank String password
    ) {}

    public record AuthResponse(String token, UserProfile user) {}

    public record UserProfile(
            Long id,
            String email,
            String phone,
            String nickname,
            String avatarUrl
    ) {}

    public record UpdateProfileRequest(
            @Size(max = 64) String nickname,
            String avatarUrl
    ) {}

    public record UpdatePasswordRequest(
            @NotBlank String oldPassword,
            @NotBlank @Size(min = 6, max = 64) String newPassword
    ) {}
}
