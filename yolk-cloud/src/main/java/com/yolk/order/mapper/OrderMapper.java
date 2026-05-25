package com.yolk.order.mapper;

import com.yolk.order.entity.OrderEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.Optional;

@Mapper
public interface OrderMapper {

    int insert(OrderEntity order);

    int update(OrderEntity order);

    Optional<OrderEntity> findByIdAndUserId(@Param("id") String id, @Param("userId") Long userId);

    List<OrderEntity> findByUserIdOrderByCreatedAtDesc(@Param("userId") Long userId);
}
