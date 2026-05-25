package com.yolk.traffic.controller;

import com.yolk.auth.AuthUtils;
import com.yolk.common.ApiResponse;
import com.yolk.traffic.dto.TrafficDtos;
import com.yolk.traffic.service.TrafficService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/traffic")
public class TrafficController {

    private final TrafficService trafficService;

    public TrafficController(TrafficService trafficService) {
        this.trafficService = trafficService;
    }

    @GetMapping("/plan")
    public ApiResponse<TrafficDtos.TokenPlanDto> currentPlan() {
        return ApiResponse.ok(trafficService.getCurrentPlan(AuthUtils.currentUserId()));
    }

    @GetMapping("/packages")
    public ApiResponse<List<TrafficDtos.RechargePackageDto>> packages() {
        return ApiResponse.ok(trafficService.listRechargePackages());
    }

    @GetMapping("/catalog")
    public ApiResponse<List<TrafficDtos.PlanCatalogItemDto>> catalog() {
        return ApiResponse.ok(trafficService.listPlanCatalog());
    }

    @GetMapping("/usage")
    public ApiResponse<TrafficDtos.UsageSeriesResponse> usage(@RequestParam(defaultValue = "week") String period) {
        return ApiResponse.ok(trafficService.getUsageSeries(AuthUtils.currentUserId(), period));
    }

    @GetMapping("/daily-limit")
    public ApiResponse<TrafficDtos.DailyLimitDto> dailyLimit() {
        return ApiResponse.ok(trafficService.getDailyLimit(AuthUtils.currentUserId()));
    }

    @PutMapping("/daily-limit")
    public ApiResponse<TrafficDtos.DailyLimitDto> updateDailyLimit(
            @Valid @RequestBody TrafficDtos.UpdateDailyLimitRequest request) {
        return ApiResponse.ok(trafficService.updateDailyLimit(AuthUtils.currentUserId(), request.dailyLimit()));
    }
}
