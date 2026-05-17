export type UsagePeriod = 'day' | 'week' | 'month';

export interface UsagePoint {
    label: string;
    value: number;
}

export interface TokenPlan {
    id: string;
    name: string;
    totalTokens: number;
    usedTokens: number;
    renewDate: string;
    badge?: string;
}

export interface RechargePackage {
    id: string;
    name: string;
    tokens: number;
    price: number;
    originalPrice?: number;
    tag?: string;
    hot?: boolean;
}

export const CURRENT_PLAN: TokenPlan = {
    id: 'plan-pro',
    name: '词元畅享包',
    totalTokens: 500_000,
    usedTokens: 312_480,
    renewDate: '2026-06-01',
    badge: '当前套餐',
};

export const RECHARGE_PACKAGES: RechargePackage[] = [
    {id: 'pack-s', name: '体验加量包', tokens: 50_000, price: 9.9, tag: '尝鲜'},
    {id: 'pack-m', name: '标准加量包', tokens: 200_000, price: 29.9, originalPrice: 39.9, hot: true},
    {id: 'pack-l', name: '专业加量包', tokens: 500_000, price: 59.9, originalPrice: 79.9},
    {id: 'pack-xl', name: '旗舰加量包', tokens: 1_200_000, price: 129.9, tag: '最划算'},
];

export const PLAN_CATALOG = [
    {id: 'basic', name: '词元基础包', tokens: 100_000, price: 19.9, desc: '适合轻度使用'},
    {id: 'pro', name: '词元畅享包', tokens: 500_000, price: 59.9, desc: '日常办公推荐'},
    {id: 'flagship', name: '词元旗舰包', tokens: 2_000_000, price: 199.9, desc: '高频 Agent 任务'},
];

export const DEFAULT_DAILY_LIMIT = 80_000;

export function formatTokens(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 10_000) return `${(n / 10_000).toFixed(1)}万`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
}

/** 套餐剩余额度档位：≥30% 绿，20%–30% 黄，<20% 红 */
export type PlanQuotaLevel = 'high' | 'medium' | 'low';

export function getPlanQuotaLevel(percentRemaining: number): PlanQuotaLevel {
    if (percentRemaining >= 30) return 'high';
    if (percentRemaining >= 20) return 'medium';
    return 'low';
}

export const PLAN_QUOTA_THEME: Record<
    PlanQuotaLevel,
    {cardClass: string; stroke: string}
> = {
    high: {
        cardClass: 'plan-card--high',
        stroke: '#b7eb8f',
    },
    medium: {
        cardClass: 'plan-card--medium',
        stroke: '#ffe58f',
    },
    low: {
        cardClass: 'plan-card--low',
        stroke: '#ffccc7',
    },
};

function pseudo(base: number, spread: number, seed: number) {
    const wobble = ((seed * 17 + 31) % 100) / 100 - 0.5;
    return Math.round(base + wobble * spread);
}

export function getUsageSeries(period: UsagePeriod): UsagePoint[] {
    if (period === 'day') {
        return Array.from({length: 24}, (_, h) => ({
            label: `${h}时`,
            value: pseudo(h >= 9 && h <= 22 ? 4200 : 800, 2000, h),
        }));
    }
    if (period === 'week') {
        const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
        return days.map((label, i) => ({
            label,
            value: pseudo(i < 5 ? 52000 : 28000, 15000, i),
        }));
    }
    return Array.from({length: 30}, (_, i) => ({
        label: `${i + 1}日`,
        value: pseudo(45000, 20000, i),
    }));
}
