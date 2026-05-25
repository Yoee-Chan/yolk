package com.yolk.chat.entity;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
public class ChatTaskEntity {

    private String id;
    private Long userId;
    private String title;
    private String sessionId;
    private boolean pinned;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
