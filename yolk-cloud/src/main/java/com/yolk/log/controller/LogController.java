package com.yolk.log.controller;

import com.yolk.auth.AuthUtils;
import com.yolk.common.ApiResponse;
import com.yolk.log.dto.LogDtos;
import com.yolk.log.service.LogService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/logs")
public class LogController {

    private final LogService logService;

    public LogController(LogService logService) {
        this.logService = logService;
    }

    @PostMapping("/batch")
    public ApiResponse<LogDtos.BatchLogResponse> ingestBatch(
            @Valid @RequestBody LogDtos.BatchLogRequest request) {
        return ApiResponse.ok(logService.ingestBatch(AuthUtils.currentUserId(), request));
    }
}
