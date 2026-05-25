package com.yolk.chat.mapper;

import com.yolk.chat.entity.ChatMessageEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface ChatMessageMapper {

    int insert(ChatMessageEntity message);

    int countByTaskId(@Param("taskId") String taskId);

    int nextSortOrder(@Param("taskId") String taskId);

    List<ChatMessageEntity> findByTaskIdOrderBySortOrder(@Param("taskId") String taskId);
}
