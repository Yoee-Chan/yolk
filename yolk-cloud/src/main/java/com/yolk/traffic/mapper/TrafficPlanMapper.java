package com.yolk.traffic.mapper;

import com.yolk.traffic.entity.TrafficPlanEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.Optional;

@Mapper
public interface TrafficPlanMapper {

    Optional<TrafficPlanEntity> findById(@Param("id") String id);

    List<TrafficPlanEntity> findAll();
}
