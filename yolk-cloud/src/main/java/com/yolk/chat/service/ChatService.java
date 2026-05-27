package com.yolk.chat.service;

import com.yolk.chat.dto.ChatDtos;
import com.yolk.chat.entity.ChatMessageEntity;
import com.yolk.chat.entity.ChatTaskEntity;
import com.yolk.chat.mapper.ChatMessageMapper;
import com.yolk.chat.mapper.ChatTaskMapper;
import com.yolk.common.BusinessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@Service
public class ChatService {

    private static final int MAX_MESSAGE_LENGTH = 64_000;
    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    private final ChatTaskMapper chatTaskMapper;
    private final ChatMessageMapper chatMessageMapper;

    public ChatService(ChatTaskMapper chatTaskMapper, ChatMessageMapper chatMessageMapper) {
        this.chatTaskMapper = chatTaskMapper;
        this.chatMessageMapper = chatMessageMapper;
    }

    @Transactional
    public ChatDtos.TaskSummaryDto createTask(Long userId) {
        var now = LocalDateTime.now();
        var task = new ChatTaskEntity();
        task.setId(UUID.randomUUID().toString());
        task.setUserId(userId);
        task.setTitle("新任务");
        task.setSessionId(task.getId().replace("-", "").substring(0, 16));
        task.setPinned(false);
        task.setCreatedAt(now);
        task.setUpdatedAt(now);
        chatTaskMapper.insert(task);
        return toSummary(task);
    }

    public List<ChatDtos.TaskSummaryDto> listTasks(Long userId) {
        return chatTaskMapper.findByUserIdOrderByPinnedAndUpdated(userId).stream()
                .map(this::toSummary)
                .toList();
    }

    public ChatDtos.TaskDetailDto getTaskDetail(Long userId, String taskId) {
        var task = requireTask(userId, taskId);
        var messages = chatMessageMapper.findByTaskIdOrderBySortOrder(taskId).stream()
                .map(this::toMessageDto)
                .toList();
        return new ChatDtos.TaskDetailDto(
                task.getId(),
                task.getTitle(),
                task.getSessionId(),
                task.isPinned(),
                formatTime(task.getCreatedAt()),
                formatTime(task.getUpdatedAt()),
                messages
        );
    }

    @Transactional
    public ChatDtos.MessageDto appendMessage(Long userId, String taskId, ChatDtos.AppendMessageRequest request) {
        requireTask(userId, taskId);
        var role = request.role().trim().toLowerCase();
        if (!role.equals("user") && !role.equals("assistant")) {
            throw new BusinessException(400, "role 必须为 user 或 assistant");
        }

        var message = new ChatMessageEntity();
        message.setTaskId(taskId);
        message.setUserId(userId);
        message.setRole(role);
        message.setContent(truncate(request.content(), MAX_MESSAGE_LENGTH));
        message.setSortOrder(chatMessageMapper.nextSortOrder(taskId));
        message.setCreatedAt(LocalDateTime.now());
        chatMessageMapper.insert(message);
        chatTaskMapper.touchUpdatedAt(taskId, userId);
        return toMessageDto(message);
    }

    @Transactional
    public ChatDtos.TaskSummaryDto updateTitle(Long userId, String taskId, ChatDtos.UpdateTitleRequest request) {
        var task = requireTask(userId, taskId);
        var title = request.title().trim();
        if (title.isEmpty()) {
            throw new BusinessException(400, "标题不能为空");
        }
        chatTaskMapper.updateTitle(taskId, userId, truncate(title, 128));
        task.setTitle(truncate(title, 128));
        task.setUpdatedAt(LocalDateTime.now());
        return toSummary(task);
    }

    @Transactional
    public ChatDtos.TaskSummaryDto updatePinned(Long userId, String taskId, ChatDtos.UpdatePinRequest request) {
        var task = requireTask(userId, taskId);
        chatTaskMapper.updatePinned(taskId, userId, request.pinned());
        task.setPinned(request.pinned());
        task.setUpdatedAt(LocalDateTime.now());
        return toSummary(task);
    }

    @Transactional
    public void softDeleteTask(Long userId, String taskId) {
        requireTask(userId, taskId);
        var updated = chatTaskMapper.softDelete(taskId, userId);
        if (updated == 0) {
            throw new BusinessException(404, "任务不存在");
        }
    }

    public boolean isFirstMessage(String taskId) {
        return chatMessageMapper.countByTaskId(taskId) == 0;
    }

    private ChatTaskEntity requireTask(Long userId, String taskId) {
        return chatTaskMapper.findByIdAndUserId(taskId, userId)
                .orElseThrow(() -> new BusinessException(404, "任务不存在"));
    }

    private ChatDtos.TaskSummaryDto toSummary(ChatTaskEntity task) {
        return new ChatDtos.TaskSummaryDto(
                task.getId(),
                task.getTitle(),
                task.getSessionId(),
                task.isPinned(),
                formatTime(task.getUpdatedAt())
        );
    }

    private ChatDtos.MessageDto toMessageDto(ChatMessageEntity message) {
        return new ChatDtos.MessageDto(
                message.getId(),
                message.getRole(),
                message.getContent(),
                formatTime(message.getCreatedAt())
        );
    }

    private static String formatTime(LocalDateTime time) {
        return time == null ? "" : time.format(ISO);
    }

    private static String truncate(String value, int maxLen) {
        if (value == null) {
            return "";
        }
        return value.length() <= maxLen ? value : value.substring(0, maxLen);
    }
}
