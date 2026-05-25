package com.yolk.traffic.entity;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class TrafficPlanEntity {

    private String id;
    private String name;
    private Long totalTokens;
    private BigDecimal price;
    private String description = "";
}
