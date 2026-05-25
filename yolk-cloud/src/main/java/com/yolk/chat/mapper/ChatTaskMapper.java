package com.yolk.chat.mapper;

import com.yolk.chat.entity.ChatMessageEntity;
import com.yolk.chat.entity.ChatTaskEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.Optional;

@Mapper
public interface ChatTaskMapper {

    int insert(ChatTaskEntity task);

    Optional<ChatTaskEntity> findByIdAndUserId(@Param("id") String id, @Param("userId") Long userId);

    List<ChatTaskEntity> findByUserIdOrderByPinnedAndUpdated(@Param("userId") Long userId);

    int updateTitle(@Param("id") String id, @Param("userId") Long userId, @Param("title") String title);

    int updatePinned(@Param("id") String id, @Param("userId") Long userId, @Param("pinned") boolean pinned);

    int touchUpdatedAt(@Param("id") String id, @Param("userId") Long userId);
}
