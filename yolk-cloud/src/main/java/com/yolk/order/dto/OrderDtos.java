package com.yolk.order.dto;

import jakarta.validation.constraints.NotBlank;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public final class OrderDtos {

    private OrderDtos() {}

    public record CreateRechargeOrderRequest(@NotBlank String packageId) {}

    public record OrderDto(
            String id,
            String packageId,
            String packageName,
            long tokens,
            BigDecimal amount,
            String status,
            String qrCodeUrl,
            LocalDateTime createdAt,
            LocalDateTime paidAt
    ) {}
}
