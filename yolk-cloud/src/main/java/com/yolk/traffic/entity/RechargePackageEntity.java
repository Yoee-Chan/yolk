package com.yolk.traffic.entity;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class RechargePackageEntity {

    private String id;
    private String name;
    private Long tokens;
    private BigDecimal price;
    private BigDecimal originalPrice;
    private String tag;
    private boolean hot;
}
