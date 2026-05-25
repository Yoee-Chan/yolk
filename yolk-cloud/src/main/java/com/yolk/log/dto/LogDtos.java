package com.yolk.log.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public final class LogDtos {

    private LogDtos() {}

    public record LogEntryRequest(
            @NotBlank @Size(max = 16) String level,
            @NotBlank String message,
            @Size(max = 255) String loggerName,
            @Size(max = 128) String functionName,
            @NotNull Integer lineNo,
            @NotBlank String loggedAt
    ) {}

    public record BatchLogRequest(
            @Size(max = 64) String sessionId,
            @NotEmpty @Valid List<LogEntryRequest> entries
    ) {}

    public record BatchLogResponse(int inserted) {}
}
