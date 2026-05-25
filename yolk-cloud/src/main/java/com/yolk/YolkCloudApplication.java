package com.yolk;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@MapperScan({
        "com.yolk.auth.mapper",
        "com.yolk.traffic.mapper",
        "com.yolk.order.mapper",
        "com.yolk.chat.mapper",
        "com.yolk.log.mapper"
})
public class YolkCloudApplication {

    public static void main(String[] args) {
        SpringApplication.run(YolkCloudApplication.class, args);
    }
}
