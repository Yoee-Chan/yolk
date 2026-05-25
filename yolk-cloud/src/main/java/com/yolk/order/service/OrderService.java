package com.yolk.order.service;

import com.yolk.common.BusinessException;
import com.yolk.order.dto.OrderDtos;
import com.yolk.order.entity.OrderEntity;
import com.yolk.order.mapper.OrderMapper;
import com.yolk.traffic.mapper.RechargePackageMapper;
import com.yolk.traffic.service.TrafficService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class OrderService {

    private final OrderMapper orderMapper;
    private final RechargePackageMapper rechargePackageMapper;
    private final TrafficService trafficService;

    public OrderService(OrderMapper orderMapper,
                        RechargePackageMapper rechargePackageMapper,
                        TrafficService trafficService) {
        this.orderMapper = orderMapper;
        this.rechargePackageMapper = rechargePackageMapper;
        this.trafficService = trafficService;
    }

    @Transactional
    public OrderDtos.OrderDto createRechargeOrder(Long userId, String packageId) {
        var pack = rechargePackageMapper.findById(packageId)
                .orElseThrow(() -> new BusinessException(404, "加量包不存在"));

        var order = new OrderEntity();
        order.setId(UUID.randomUUID().toString());
        order.setUserId(userId);
        order.setPackageId(pack.getId());
        order.setPackageName(pack.getName());
        order.setTokens(pack.getTokens());
        order.setAmount(pack.getPrice());
        order.setStatus("PENDING");
        order.setQrCodeUrl(null);
        order.setCreatedAt(LocalDateTime.now());
        orderMapper.insert(order);

        return toDto(order);
    }

    public OrderDtos.OrderDto getOrder(Long userId, String orderId) {
        var order = orderMapper.findByIdAndUserId(orderId, userId)
                .orElseThrow(() -> new BusinessException(404, "订单不存在"));
        return toDto(order);
    }

    public List<OrderDtos.OrderDto> listOrders(Long userId) {
        return orderMapper.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(this::toDto)
                .toList();
    }

    /** MVP：模拟支付成功，后续替换为微信/支付宝回调 */
    @Transactional
    public OrderDtos.OrderDto confirmPaid(Long userId, String orderId) {
        var order = orderMapper.findByIdAndUserId(orderId, userId)
                .orElseThrow(() -> new BusinessException(404, "订单不存在"));
        if ("PAID".equals(order.getStatus())) {
            return toDto(order);
        }
        if (!"PENDING".equals(order.getStatus())) {
            throw new BusinessException(400, "订单状态不可支付");
        }
        order.setStatus("PAID");
        order.setPaidAt(LocalDateTime.now());
        orderMapper.update(order);
        trafficService.addTokens(userId, order.getTokens());
        return toDto(order);
    }

    private OrderDtos.OrderDto toDto(OrderEntity order) {
        return new OrderDtos.OrderDto(
                order.getId(),
                order.getPackageId(),
                order.getPackageName(),
                order.getTokens(),
                order.getAmount(),
                order.getStatus(),
                order.getQrCodeUrl(),
                order.getCreatedAt(),
                order.getPaidAt()
        );
    }
}
