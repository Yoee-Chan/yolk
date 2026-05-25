package com.yolk.order.entity;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
public class OrderEntity {

    private String id;
    private Long userId;
    private String packageId;
    private String packageName;
    private Long tokens;
    private BigDecimal amount;
    private String status = "PENDING";
    private String qrCodeUrl;
    private LocalDateTime createdAt;
    private LocalDateTime paidAt;
}
