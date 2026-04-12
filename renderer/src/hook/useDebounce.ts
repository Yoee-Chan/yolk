import {useState, useEffect} from "react";

/**
 * 自定义防抖 Hook
 * @param value 任意类型的输入值
 * @param delay 延迟时间（毫秒）
 * @returns 防抖后的值
 */
export default function useDebounce<T>(value: T, delay: number = 500): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}
