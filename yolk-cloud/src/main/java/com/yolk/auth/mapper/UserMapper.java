package com.yolk.auth.mapper;

import com.yolk.auth.entity.UserEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.Optional;

@Mapper
public interface UserMapper {

    Optional<UserEntity> findById(@Param("id") Long id);

    Optional<UserEntity> findByEmail(@Param("email") String email);

    Optional<UserEntity> findByPhone(@Param("phone") String phone);

    boolean existsByEmail(@Param("email") String email);

    boolean existsByPhone(@Param("phone") String phone);

    int insert(UserEntity user);

    int update(UserEntity user);
}
