# DOCX 高保真投影编辑设计

## 目标

Yolk 支持导入 Word（`.docx`）文章，在浏览器中提供接近 Word/PDF 的展示投影，用户和 AI 可以在投影上编辑内容与常用格式，保存时将修改重新交换回 OOXML，并重新打包为高保真 DOCX。

产品目标不是承诺 ZIP 二进制逐字节不变，而是：

- 未修改的 Word 内容、格式、资源和复杂对象尽量原样保留；
- 用户明确修改的内容可控地写回 DOCX；
- 页眉、页脚、脚注、文本框、图表等暂不编辑的部分仍然保留；
- 浏览器展示以 PDF/Word 渲染结果为视觉参考，编辑操作作用于投影背后的结构化文档模型；
- AI 通过可验证、可撤销的结构化操作修改文档，而不是直接覆盖整篇 HTML。

## 核心原则

1. **完整 DOCX 包是源数据**：DOCX 是 ZIP 容器，不能只保存 `word/document.xml`。
2. **HTML/PDF 是投影**：HTML 用于交互编辑，PDF 或临时 DOCX 渲染用于高保真视觉预览；投影不能成为唯一数据源。
3. **操作是交换协议**：用户和 AI 产生结构化操作，转换器把操作映射到语义模型，再增量写回 OOXML。
4. **未知内容不删除**：暂不支持编辑的 XML、关系、媒体和部件以原始字节或原始 XML 保留，重新打包时继续写回。
5. **脏部件增量写回**：优先只修改受影响的段落、运行、关系和资源，不完整重建整个文档。
6. **可回滚可验证**：每个操作都应可预览 diff、撤销、重做，并在应用前验证目标节点和期望文本。

## 用户可见流程

```text
导入 DOCX
  ↓
读取完整 ZIP 包和 OOXML 关系
  ↓
解析 document/styles/numbering/media 等可编辑模型
  ↓
生成浏览器编辑投影 + 临时高保真预览
  ↓
用户或 AI 产生结构化编辑操作
  ↓
操作应用到 Yolk 文档模型
  ↓
重新生成投影并标记脏部件
  ↓
复制原始包，仅覆盖脏部件
  ↓
校验关系、内容类型和 ZIP 可打开性
  ↓
导出/保存高保真 DOCX
```

未修改页面的页眉页脚、复杂对象和其他 OOXML 部件不需要先转换成可编辑 HTML；它们保留在原始包中，视觉预览通过 PDF/Word 渲染体现。

## DOCX 包模型

DOCX 中正文主要在 `word/document.xml`，但高保真保存至少需要保留整个 ZIP：

```text
[Content_Types].xml
_rels/.rels
docProps/*
word/document.xml
word/styles.xml
word/numbering.xml
word/settings.xml
word/fontTable.xml
word/theme/*
word/_rels/document.xml.rels
word/media/*
word/header*.xml
word/footer*.xml
word/footnotes.xml
word/endnotes.xml
word/comments.xml
word/webSettings.xml
```

导入模型：

```ts
type DocxPackage = {
    originalFileName: string;
    entries: Map<string, Uint8Array>;
    parts: {
        document: XmlDocument;
        styles?: XmlDocument;
        numbering?: XmlDocument;
        relationships?: XmlDocument;
        contentTypes?: XmlDocument;
        headers: Map<string, XmlDocument>;
        footers: Map<string, XmlDocument>;
        unknown: Map<string, Uint8Array>;
    };
};
```

`entries` 永远保留所有原始条目。解析器暂时不理解的元素、属性、命名空间和部件不能因为导入而丢失。

## 双层文档模型

### 原始 OOXML 层

保存原始 ZIP 条目、XML 部件、媒体二进制、关系和内容类型。它负责非破坏式往返。

### Yolk 语义层

HTML/PDF 投影和 UI 不直接操作 XML，而是操作语义节点：

```ts
type YolkDocument = {
    documentId: string;
    title: string;
    blocks: DocumentBlock[];
    styles: StyleRegistry;
    numbering: NumberingRegistry;
    assets: AssetRegistry;
    sections: SectionDefinition[];
    sourcePackage: DocxPackage;
};

type DocumentBlock =
    | ParagraphBlock
    | TableBlock
    | ImageBlock
    | PageBreakBlock
    | UnsupportedBlock;

type ParagraphBlock = {
    id: string;
    source: {part: string; xmlPath: string; paragraphId?: string};
    styleId?: string;
    properties: ParagraphProperties;
    runs: InlineNode[];
    rawXml?: string;
    dirty: boolean;
};

type TextRun = {
    id: string;
    type: 'text';
    text: string;
    styleId?: string;
    properties: RunProperties;
    source: {xmlPath: string};
    dirty: boolean;
};

type UnsupportedBlock = {
    id: string;
    type: 'unsupported';
    sourcePart: string;
    rawXml: string;
    editable: false;
};
```

## PDF/Word 高保真展示策略

浏览器编辑投影和保真预览分离：

```text
YolkDocument
  ├─ HTML/CSS 投影：支持选区、编辑、AI 操作
  └─ 临时 DOCX → PDF/页面：核对分页、页眉页脚、图片和复杂布局
```

导入或保存后生成临时工作副本，通过以下优先级之一渲染 PDF：

1. Windows 已安装 Microsoft Word 的自动化导出；
2. LibreOffice headless 导出；
3. 其他兼容的 DOCX 渲染服务。

PDF 仅用于展示/校验，不反向生成 DOCX，也不作为编辑数据源。没有可用渲染器时，HTML 投影作为降级展示，并明确这是编辑视图而非最终分页效果。

建议 UI 同时提供：

- 编辑视图：可选中文字、改写、格式调整；
- 保真预览：PDF 页面视图，展示页眉页脚和暂不支持编辑的对象；
- 变更标记：指出当前编辑投影与最近一次高保真预览的差异。

## 投影与节点映射

编辑 HTML 必须为节点携带稳定 ID，不能编辑后只读取整个 `innerHTML` 再猜测 XML：

```html
<p data-yolk-node-id="paragraph-42" data-yolk-style-id="Normal">
  <span data-yolk-run-id="run-101">原文</span>
  <strong data-yolk-run-id="run-102">加粗文字</strong>
</p>
```

映射表需要记录 UI 字符偏移到 OOXML `w:r/w:t` 的关系：

```ts
type TextSegmentMapping = {
    displayStart: number;
    displayEnd: number;
    runId: string;
    sourceTextNodePath: string;
    sourceStart: number;
    sourceEnd: number;
};
```

Word 的一个可见句子可能跨越多个 `w:r`。修改选区时应定位并拆分边界运行，只修改选区对应的节点，保留未选中的运行和原有属性。

## 编辑操作协议

用户编辑和 AI 编辑统一成操作：

```ts
type DocumentOperation =
    | {type: 'replaceText'; paragraphId: string; start: number; end: number; expectedText: string; text: string; formatPolicy: FormatPolicy}
    | {type: 'applyRunFormatting'; paragraphId: string; start: number; end: number; formatting: Partial<RunProperties>}
    | {type: 'setParagraphFormatting'; paragraphId: string; formatting: Partial<ParagraphProperties>}
    | {type: 'insertParagraph'; afterBlockId: string; paragraph: NewParagraphInput}
    | {type: 'deleteBlock'; blockId: string}
    | {type: 'insertImage'; afterBlockId: string; assetId: string; properties: ImageProperties};

type FormatPolicy =
    | 'preserve-runs'
    | 'inherit-first-run'
    | 'inherit-majority'
    | 'plain'
    | 'explicit';
```

AI 返回操作而不是整篇 HTML：

```json
{
  "operations": [
    {
      "type": "replaceText",
      "paragraphId": "paragraph-42",
      "start": 8,
      "end": 35,
      "expectedText": "原来的选中文字",
      "text": "AI 修改后的文字",
      "formatPolicy": "preserve-runs"
    }
  ]
}
```

应用前必须校验：节点存在、偏移有效、`expectedText` 与当前文档一致、操作没有越过不可编辑对象。AI 结果先展示 diff，用户确认后才应用。

## OOXML 编辑规则

### 文本

- 读取 `w:p/w:r/w:t`，尊重 `xml:space="preserve"`；
- 维护段落显示文本和 run 映射；
- 替换文字时在边界拆分 `w:r`，尽量保留每段原 `w:rPr`；
- 新文本无法一一匹配时按 `formatPolicy` 继承格式；
- 不重建无关段落。

### 格式

常用属性映射：

```text
w:b / w:i / w:u / w:strike → font-weight / font-style / text-decoration
w:rFonts                   → font-family
w:sz                       → font-size
w:color                    → color
w:highlight / w:shd        → background-color
w:jc                       → text-align
w:spacing                  → line-height / paragraph spacing
w:ind                      → text-indent / padding
w:tblBorders               → border
w:gridSpan / w:vMerge      → colspan / rowspan
```

### 图片

原始媒体二进制不经过 Canvas 或重新压缩。图片展示使用 Blob URL；导出时保留原始 `word/media/*`，新增图片才更新：

- `word/document.xml`；
- `word/_rels/document.xml.rels`；
- `[Content_Types].xml`；
- `word/media/*`。

### 复杂对象

页眉、页脚、脚注、尾注、批注、书签、域、文本框、形状、SmartArt、图表、公式、内容控件和修订记录，第一阶段可只读展示或仅通过 PDF 显示，但必须原样保留。原则是“暂不支持编辑”而不是“导入时删除”。

## 保存与重新打包

工作区不要把完整 DOCX Base64 塞入普通文章 JSON。建议：

```text
微信公众号/
  articles/
    <document-id>/
      article.json
      source.docx
      working.docx
      operations.json
      package/
        [Content_Types].xml
        _rels/
        word/
      assets/
```

保存流程：

1. 记录操作并更新语义模型；
2. 标记受影响的 ZIP 部件；
3. 复制原始 ZIP 条目；
4. 仅序列化脏 XML 部件；
5. 原样写回未修改部件和媒体；
6. 管理新资源、关系 ID 和内容类型；
7. 重新打包为 `working.docx`；
8. 验证 ZIP、XML、关系和 Word 可打开性；
9. 生成 PDF 保真预览。

ZIP 重新压缩后不保证二进制字节完全一致，但应保证语义、格式和未修改部件尽量不变。

## 当前 Yolk 的迁移方向

当前文章草稿主要是 `title/subtitle/content/outlineTree`，其中 `content` 可能是 Markdown 或 HTML。该结构可以作为旧版/降级数据，但不能承载高保真 DOCX。

建议演进：

```ts
type YolkArticleDraftV2 = {
    version: 2;
    documentId: string;
    title: string;
    subtitle: string;
    source?: {
        type: 'docx';
        originalFileName: string;
        packagePath: string;
        originalHash: string;
    };
    documentSnapshotPath: string;
    operationsPath: string;
    view: {html: string; outlineTree: OutlineNode[]};
    updatedAt: string;
};
```

现有 `mammoth` 可以保留作为快速 HTML 降级导入，但不能作为高保真往返核心。现有 `docx` 库适合生成全新文档或模板文档，不适合直接修改已有 DOCX。

## 实施阶段

### 阶段 0：基线与验证

- 建立 DOCX fixture 集合：Word、WPS、LibreOffice 文档；
- 实现 ZIP 条目清单、哈希、导入/导出不修改往返；
- 验证未知部件、图片、关系、页眉页脚不丢失；
- 接入 PDF 预览管线。

### 阶段 1：完整包读取和投影

- ZIP 读取/写入；
- XML 命名空间安全解析；
- `document.xml`、styles、numbering、relationships、media 解析；
- 生成带节点 ID 的 HTML 编辑投影；
- 生成高保真 PDF/Word 预览；
- 不修改直接重新打包。

### 阶段 2：文字增量编辑

- 段落/run ID 和字符映射；
- 替换、插入、删除文字；
- 撤销/重做；
- 只更新受影响的 `w:p`。

### 阶段 3：基础格式编辑

- 加粗、斜体、下划线、颜色、字号、字体；
- 段落对齐、缩进、行距；
- 标题样式和分页符。

### 阶段 4：AI 操作

- 选区改写、扩写、缩写；
- 标题和大纲调整；
- AI 插入段落/图片；
- JSON Schema 校验；
- diff、用户确认、撤销。

### 阶段 5：表格、列表和资源

- 多级编号；
- 普通表格和合并单元格；
- 图片、超链接；
- 新资源和关系管理。

### 阶段 6：兼容性和保真验证

- DOCX 重新导入；
- Word/LibreOffice 打开验证；
- PDF 页面截图对比；
- 文本、图片、关系和未修改部件哈希比较；
- WPS/Word/LibreOffice 互操作测试。

## 第一阶段验收标准

导入一个 DOCX 后，在不做任何编辑的情况下重新打包：

- Word 可以打开；
- 正文、图片、表格、列表、页眉页脚和未知部件仍存在；
- 未修改 ZIP 条目字节保持不变或内容哈希保持不变；
- XML 命名空间、关系 ID 和内容类型有效；
- PDF 预览可生成时，页面布局与源文档基本一致；
- HTML 编辑投影中的每个可编辑节点都能定位回 OOXML 源节点。

这份文档是后续实现的设计基线。后续代码应优先完成阶段 0 和阶段 1，不应继续扩展当前“DOCX → Mammoth HTML → innerHTML → 新 DOCX”的无损假设链路。
