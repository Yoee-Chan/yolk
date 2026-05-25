package com.yolk.chat.entity;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
public class ChatMessageEntity {

    private Long id;
    private String taskId;
    private Long userId;
    private String role;
    private String content;
    private Integer sortOrder;
    private LocalDateTime createdAt;
}
