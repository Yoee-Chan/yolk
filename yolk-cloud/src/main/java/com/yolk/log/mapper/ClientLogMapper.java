package com.yolk.log.mapper;

import com.yolk.log.entity.ClientLogEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface ClientLogMapper {

    int insertBatch(@Param("logs") List<ClientLogEntity> logs);
}
