package com.yolk.log.service;

import com.yolk.common.BusinessException;
import com.yolk.log.dto.LogDtos;
import com.yolk.log.entity.ClientLogEntity;
import com.yolk.log.mapper.ClientLogMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;

@Service
public class LogService {

    private static final int MAX_BATCH_SIZE = 200;
    private static final int MAX_MESSAGE_LENGTH = 16_000;

    private final ClientLogMapper clientLogMapper;

    public LogService(ClientLogMapper clientLogMapper) {
        this.clientLogMapper = clientLogMapper;
    }

    @Transactional
    public LogDtos.BatchLogResponse ingestBatch(Long userId, LogDtos.BatchLogRequest request) {
        var entries = request.entries();
        if (entries.size() > MAX_BATCH_SIZE) {
            throw new BusinessException(400, "单次最多上传 " + MAX_BATCH_SIZE + " 条日志");
        }

        var sessionId = normalizeOptional(request.sessionId(), 64);
        var logs = new ArrayList<ClientLogEntity>(entries.size());
        for (var entry : entries) {
            var entity = new ClientLogEntity();
            entity.setUserId(userId);
            entity.setSessionId(sessionId);
            entity.setLevel(entry.level().trim().toUpperCase());
            entity.setLoggerName(normalizeOptional(entry.loggerName(), 255));
            entity.setFunctionName(normalizeOptional(entry.functionName(), 128));
            entity.setLineNo(entry.lineNo() != null ? entry.lineNo() : 0);
            entity.setMessage(truncate(entry.message(), MAX_MESSAGE_LENGTH));
            entity.setLoggedAt(parseLoggedAt(entry.loggedAt()));
            logs.add(entity);
        }

        if (logs.isEmpty()) {
            return new LogDtos.BatchLogResponse(0);
        }

        int inserted = clientLogMapper.insertBatch(logs);
        return new LogDtos.BatchLogResponse(inserted);
    }

    private static String normalizeOptional(String value, int maxLen) {
        if (value == null) {
            return "";
        }
        var trimmed = value.trim();
        return trimmed.length() <= maxLen ? trimmed : trimmed.substring(0, maxLen);
    }

    private static String truncate(String value, int maxLen) {
        if (value == null) {
            return "";
        }
        return value.length() <= maxLen ? value : value.substring(0, maxLen);
    }

    private static LocalDateTime parseLoggedAt(String raw) {
        if (raw == null || raw.isBlank()) {
            return LocalDateTime.now();
        }
        var text = raw.trim();
        try {
            return Instant.parse(text).atZone(ZoneId.systemDefault()).toLocalDateTime();
        } catch (DateTimeParseException ignored) {
            /* fall through */
        }
        try {
            return LocalDateTime.parse(text, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        } catch (DateTimeParseException e) {
            throw new BusinessException(400, "无效的 loggedAt: " + raw);
        }
    }
}
