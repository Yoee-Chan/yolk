import {desktopApi} from '../../platform/desktopApi';
import {buildSeedStore} from './seedData';
import type {PipelineStore} from './types';

const STORE_VERSION = 1;

/** 纯浏览器（npm run dev:renderer）下没有 Tauri 命令，降级为内存态，不反复报错。 */
let persistenceAvailable = true;

function normalize(raw: unknown): PipelineStore | null {
    if (!raw || typeof raw !== 'object') return null;
    const value = raw as Partial<PipelineStore>;
    if (!Array.isArray(value.definitions) || !Array.isArray(value.executions)) {
        return null;
    }
    return {
        version: typeof value.version === 'number' ? value.version : STORE_VERSION,
        updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
        definitions: value.definitions,
        executions: value.executions,
    };
}

/** 读取本机 `<workspace>/流水线任务/pipelines.json`；不存在时写入种子数据。 */
export async function loadPipelineStore(): Promise<PipelineStore> {
    try {
        const raw = await desktopApi.loadPipelineStore();
        const loaded = normalize(raw);
        if (loaded) return loaded;
    } catch {
        persistenceAvailable = false;
        return buildSeedStore();
    }
    const seed = buildSeedStore();
    await savePipelineStore(seed);
    return seed;
}

/** 写回本机 JSON，返回实际落盘路径；降级为内存态时返回空串。 */
export async function savePipelineStore(store: PipelineStore): Promise<string> {
    if (!persistenceAvailable) return '';
    try {
        return await desktopApi.savePipelineStore({
            ...store,
            version: STORE_VERSION,
            updatedAt: new Date().toISOString(),
        });
    } catch {
        persistenceAvailable = false;
        return '';
    }
}
