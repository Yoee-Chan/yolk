import {createHash} from 'crypto'

export function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    }[character] || character))
}

export function hashBytes(bytes: Uint8Array): string {
    return createHash('sha256').update(bytes).digest('hex')
}
