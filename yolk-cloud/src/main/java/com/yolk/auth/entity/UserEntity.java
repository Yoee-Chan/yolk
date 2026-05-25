package com.yolk.auth.entity;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
public class UserEntity {

    private Long id;
    private String email;
    private String phone;
    private String passwordHash;
    private String nickname = "";
    private String avatarUrl;
    private LocalDateTime createdAt;
}
