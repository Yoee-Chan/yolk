package com.yolk.traffic.mapper;

import com.yolk.traffic.entity.RechargePackageEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.Optional;

@Mapper
public interface RechargePackageMapper {

    Optional<RechargePackageEntity> findById(@Param("id") String id);

    List<RechargePackageEntity> findAll();
}
