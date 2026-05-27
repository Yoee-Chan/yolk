package com.yolk.chat.controller;

import com.yolk.auth.AuthUtils;
import com.yolk.chat.dto.ChatDtos;
import com.yolk.chat.service.ChatService;
import com.yolk.common.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/chat/tasks")
public class ChatController {

    private final ChatService chatService;

    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    @PostMapping
    public ApiResponse<ChatDtos.TaskSummaryDto> createTask() {
        return ApiResponse.ok(chatService.createTask(AuthUtils.currentUserId()));
    }

    @GetMapping
    public ApiResponse<List<ChatDtos.TaskSummaryDto>> listTasks() {
        return ApiResponse.ok(chatService.listTasks(AuthUtils.currentUserId()));
    }

    @GetMapping("/{id}")
    public ApiResponse<ChatDtos.TaskDetailDto> getTask(@PathVariable String id) {
        return ApiResponse.ok(chatService.getTaskDetail(AuthUtils.currentUserId(), id));
    }

    @PostMapping("/{id}/messages")
    public ApiResponse<ChatDtos.MessageDto> appendMessage(
            @PathVariable String id,
            @Valid @RequestBody ChatDtos.AppendMessageRequest request) {
        return ApiResponse.ok(chatService.appendMessage(AuthUtils.currentUserId(), id, request));
    }

    @PutMapping("/{id}/title")
    public ApiResponse<ChatDtos.TaskSummaryDto> updateTitle(
            @PathVariable String id,
            @Valid @RequestBody ChatDtos.UpdateTitleRequest request) {
        return ApiResponse.ok(chatService.updateTitle(AuthUtils.currentUserId(), id, request));
    }

    @PutMapping("/{id}/pin")
    public ApiResponse<ChatDtos.TaskSummaryDto> updatePin(
            @PathVariable String id,
            @Valid @RequestBody ChatDtos.UpdatePinRequest request) {
        return ApiResponse.ok(chatService.updatePinned(AuthUtils.currentUserId(), id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteTask(@PathVariable String id) {
        chatService.softDeleteTask(AuthUtils.currentUserId(), id);
        return ApiResponse.ok();
    }
}
