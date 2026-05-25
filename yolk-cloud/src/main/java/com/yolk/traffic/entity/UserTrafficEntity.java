package com.yolk.traffic.entity;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
public class UserTrafficEntity {

    private Long userId;
    private String planId;
    private Long totalTokens;
    private Long usedTokens = 0L;
    private LocalDate renewDate;
    private Long dailyLimit = 80_000L;
}
