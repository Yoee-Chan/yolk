package com.yolk.traffic.dto;

import java.math.BigDecimal;
import java.util.List;

public final class TrafficDtos {

    private TrafficDtos() {}

    /** 对齐前端 TokenPlan */
    public record TokenPlanDto(
            String id,
            String name,
            long totalTokens,
            long usedTokens,
            String renewDate,
            String badge
    ) {}

    /** 对齐前端 RechargePackage */
    public record RechargePackageDto(
            String id,
            String name,
            long tokens,
            BigDecimal price,
            BigDecimal originalPrice,
            String tag,
            Boolean hot
    ) {}

    public record PlanCatalogItemDto(
            String id,
            String name,
            long tokens,
            BigDecimal price,
            String desc
    ) {}

    public record UsagePointDto(String label, long value) {}

    public record DailyLimitDto(long dailyLimit) {}

    public record UpdateDailyLimitRequest(long dailyLimit) {}

    public record UsageSeriesResponse(String period, List<UsagePointDto> points) {}
}
