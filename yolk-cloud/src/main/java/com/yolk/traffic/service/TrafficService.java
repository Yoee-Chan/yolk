package com.yolk.traffic.service;

import com.yolk.common.BusinessException;
import com.yolk.traffic.dto.TrafficDtos;
import com.yolk.traffic.entity.UsageRecordEntity;
import com.yolk.traffic.mapper.RechargePackageMapper;
import com.yolk.traffic.mapper.TrafficPlanMapper;
import com.yolk.traffic.mapper.UsageRecordMapper;
import com.yolk.traffic.mapper.UserTrafficMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
public class TrafficService {

    private final UserTrafficMapper userTrafficMapper;
    private final TrafficPlanMapper trafficPlanMapper;
    private final RechargePackageMapper rechargePackageMapper;
    private final UsageRecordMapper usageRecordMapper;

    public TrafficService(UserTrafficMapper userTrafficMapper,
                          TrafficPlanMapper trafficPlanMapper,
                          RechargePackageMapper rechargePackageMapper,
                          UsageRecordMapper usageRecordMapper) {
        this.userTrafficMapper = userTrafficMapper;
        this.trafficPlanMapper = trafficPlanMapper;
        this.rechargePackageMapper = rechargePackageMapper;
        this.usageRecordMapper = usageRecordMapper;
    }

    public TrafficDtos.TokenPlanDto getCurrentPlan(Long userId) {
        var traffic = userTrafficMapper.findByUserId(userId)
                .orElseThrow(() -> new BusinessException(404, "流量账户不存在"));
        var plan = trafficPlanMapper.findById(traffic.getPlanId())
                .orElseThrow(() -> new BusinessException(404, "套餐不存在"));
        return new TrafficDtos.TokenPlanDto(
                plan.getId(),
                plan.getName(),
                traffic.getTotalTokens(),
                traffic.getUsedTokens(),
                traffic.getRenewDate().toString(),
                "当前套餐"
        );
    }

    public List<TrafficDtos.RechargePackageDto> listRechargePackages() {
        return rechargePackageMapper.findAll().stream()
                .map(p -> new TrafficDtos.RechargePackageDto(
                        p.getId(),
                        p.getName(),
                        p.getTokens(),
                        p.getPrice(),
                        p.getOriginalPrice(),
                        p.getTag(),
                        p.isHot() ? true : null
                ))
                .toList();
    }

    public List<TrafficDtos.PlanCatalogItemDto> listPlanCatalog() {
        return trafficPlanMapper.findAll().stream()
                .map(p -> new TrafficDtos.PlanCatalogItemDto(
                        p.getId(),
                        p.getName(),
                        p.getTotalTokens(),
                        p.getPrice(),
                        p.getDescription()
                ))
                .toList();
    }

    public TrafficDtos.DailyLimitDto getDailyLimit(Long userId) {
        var traffic = requireTraffic(userId);
        return new TrafficDtos.DailyLimitDto(traffic.getDailyLimit());
    }

    @Transactional
    public TrafficDtos.DailyLimitDto updateDailyLimit(Long userId, long limit) {
        if (limit < 1000 || limit > 10_000_000) {
            throw new BusinessException(400, "日限额范围 1000 ~ 10000000");
        }
        var traffic = requireTraffic(userId);
        traffic.setDailyLimit(limit);
        userTrafficMapper.update(traffic);
        return new TrafficDtos.DailyLimitDto(limit);
    }

    public TrafficDtos.UsageSeriesResponse getUsageSeries(Long userId, String period) {
        LocalDate today = LocalDate.now();
        List<UsageRecordEntity> stored = switch (period) {
            case "day" -> usageRecordMapper.findByUserIdAndPeriodBetween(
                    userId, "day", today, today);
            case "week" -> usageRecordMapper.findByUserIdAndPeriodBetween(
                    userId, "week", today.minusDays(6), today);
            case "month" -> usageRecordMapper.findByUserIdAndPeriodBetween(
                    userId, "month", today.minusDays(29), today);
            default -> throw new BusinessException(400, "period 仅支持 day/week/month");
        };

        List<TrafficDtos.UsagePointDto> points = stored.isEmpty()
                ? generateMockUsage(period)
                : stored.stream()
                .map(r -> new TrafficDtos.UsagePointDto(r.getLabel(), r.getTokens()))
                .toList();

        return new TrafficDtos.UsageSeriesResponse(period, points);
    }

    @Transactional
    public void addTokens(Long userId, long tokens) {
        var traffic = requireTraffic(userId);
        traffic.setTotalTokens(traffic.getTotalTokens() + tokens);
        userTrafficMapper.update(traffic);
    }

    private com.yolk.traffic.entity.UserTrafficEntity requireTraffic(Long userId) {
        return userTrafficMapper.findByUserId(userId)
                .orElseThrow(() -> new BusinessException(404, "流量账户不存在"));
    }

    /** MVP：无真实用量上报时返回与前端 mock 相近的曲线 */
    private List<TrafficDtos.UsagePointDto> generateMockUsage(String period) {
        List<TrafficDtos.UsagePointDto> points = new ArrayList<>();
        if ("day".equals(period)) {
            for (int h = 0; h < 24; h++) {
                long base = (h >= 9 && h <= 22) ? 4200 : 800;
                points.add(new TrafficDtos.UsagePointDto(h + "时", pseudo(base, 2000, h)));
            }
        } else if ("week".equals(period)) {
            String[] days = {"周一", "周二", "周三", "周四", "周五", "周六", "周日"};
            for (int i = 0; i < days.length; i++) {
                long base = i < 5 ? 52000 : 28000;
                points.add(new TrafficDtos.UsagePointDto(days[i], pseudo(base, 15000, i)));
            }
        } else {
            for (int i = 0; i < 30; i++) {
                points.add(new TrafficDtos.UsagePointDto((i + 1) + "日", pseudo(45000, 20000, i)));
            }
        }
        return points;
    }

    private long pseudo(long base, long spread, int seed) {
        double wobble = ((seed * 17 + 31) % 100) / 100.0 - 0.5;
        return Math.round(base + wobble * spread);
    }
}
