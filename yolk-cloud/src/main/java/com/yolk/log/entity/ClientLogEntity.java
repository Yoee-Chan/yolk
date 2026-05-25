package com.yolk.log.entity;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
public class ClientLogEntity {

    private Long id;
    private Long userId;
    private String sessionId;
    private String level;
    private String loggerName;
    private String functionName;
    private Integer lineNo;
    private String message;
    private LocalDateTime loggedAt;
}
