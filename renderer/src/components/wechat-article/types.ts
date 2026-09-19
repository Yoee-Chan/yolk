export type StreamPayload = {
    type?: string;
    text?: string;
};

export type OutlineNode = {
    id: string;
    level: number;
    text: string;
    children: OutlineNode[];
};

export type AnnotationMenuPosition = {
    x: number;
    y: number;
};
