package com.yolk.traffic.entity;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
public class UsageRecordEntity {

    private Long id;
    private Long userId;
    private String periodType;
    private String label;
    private Long tokens;
    private LocalDate recordedAt;
}
