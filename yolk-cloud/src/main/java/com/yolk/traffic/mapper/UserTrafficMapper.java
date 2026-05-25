package com.yolk.traffic.mapper;

import com.yolk.traffic.entity.UserTrafficEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.Optional;

@Mapper
public interface UserTrafficMapper {

    Optional<UserTrafficEntity> findByUserId(@Param("userId") Long userId);

    int insert(UserTrafficEntity traffic);

    int update(UserTrafficEntity traffic);
}
