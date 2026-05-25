package com.yolk.chat.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public final class ChatDtos {

    private ChatDtos() {}

    public record TaskSummaryDto(
            String id,
            String title,
            String sessionId,
            boolean pinned,
            String updatedAt
    ) {}

    public record MessageDto(
            Long id,
            String role,
            String content,
            String createdAt
    ) {}

    public record TaskDetailDto(
            String id,
            String title,
            String sessionId,
            boolean pinned,
            String createdAt,
            String updatedAt,
            List<MessageDto> messages
    ) {}

    public record CreateTaskResponse(TaskSummaryDto task) {}

    public record AppendMessageRequest(
            @NotBlank @Size(max = 16) String role,
            @NotBlank String content
    ) {}

    public record UpdateTitleRequest(
            @NotBlank @Size(max = 128) String title
    ) {}

    public record UpdatePinRequest(
            @NotNull Boolean pinned
    ) {}
}
