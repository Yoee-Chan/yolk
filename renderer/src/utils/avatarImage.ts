/** 原图最大 2MB；压缩后用于上传，避免 Base64 JSON 超过服务端限制 */
export const MAX_AVATAR_FILE_BYTES = 2 * 1024 * 1024;

const MAX_SIDE = 512;
const TARGET_MAX_DATA_URL_CHARS = 900_000;

/**
 * 将图片文件压缩为 JPEG data URL，便于存入 profile 接口。
 */
export async function fileToAvatarDataUrl(file: File): Promise<string> {
    if (file.size > MAX_AVATAR_FILE_BYTES) {
        throw new Error('头像图片不能超过 2M');
    }

    const bitmap = await createImageBitmap(file);
    try {
        let width = bitmap.width;
        let height = bitmap.height;
        const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('无法处理图片');
        }
        ctx.drawImage(bitmap, 0, 0, width, height);

        let quality = 0.88;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length > TARGET_MAX_DATA_URL_CHARS && quality > 0.45) {
            quality -= 0.08;
            dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        return dataUrl;
    } finally {
        bitmap.close();
    }
}
