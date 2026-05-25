package com.yolk.order.controller;

import com.yolk.auth.AuthUtils;
import com.yolk.common.ApiResponse;
import com.yolk.order.dto.OrderDtos;
import com.yolk.order.service.OrderService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping("/recharge")
    public ApiResponse<OrderDtos.OrderDto> createRecharge(
            @Valid @RequestBody OrderDtos.CreateRechargeOrderRequest request) {
        return ApiResponse.ok(orderService.createRechargeOrder(
                AuthUtils.currentUserId(), request.packageId()));
    }

    @GetMapping("/{id}")
    public ApiResponse<OrderDtos.OrderDto> get(@PathVariable String id) {
        return ApiResponse.ok(orderService.getOrder(AuthUtils.currentUserId(), id));
    }

    @GetMapping
    public ApiResponse<List<OrderDtos.OrderDto>> list() {
        return ApiResponse.ok(orderService.listOrders(AuthUtils.currentUserId()));
    }

    @PostMapping("/{id}/confirm-paid")
    public ApiResponse<OrderDtos.OrderDto> confirmPaid(@PathVariable String id) {
        return ApiResponse.ok(orderService.confirmPaid(AuthUtils.currentUserId(), id));
    }
}
