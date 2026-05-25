package com.yolk.traffic.mapper;

import com.yolk.traffic.entity.UsageRecordEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDate;
import java.util.List;

@Mapper
public interface UsageRecordMapper {

    List<UsageRecordEntity> findByUserIdAndPeriodBetween(
            @Param("userId") Long userId,
            @Param("periodType") String periodType,
            @Param("start") LocalDate start,
            @Param("end") LocalDate end);
}
