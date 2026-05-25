# -*- coding: utf-8 -*-
"""生成 AI Agent 与 Java/中间件 两份 Word 简历。"""
from __future__ import annotations

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor

WORK_YEARS = "5 年（4 年正式 + 1 年实习）"


def set_doc_font(doc: Document, name: str = "微软雅黑") -> None:
    style = doc.styles["Normal"]
    style.font.name = name
    style.font.size = Pt(10.5)
    style._element.rPr.rFonts.set(qn("w:eastAsia"), name)


def add_title(doc: Document, text: str, size: int = 16) -> None:
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run(text)
    run.bold = True
    run.font.size = Pt(size)
    run.font.name = "微软雅黑"
    run._element.rPr.rFonts.set(qn("w:eastAsia"), "微软雅黑")


def add_subtitle(doc: Document, text: str) -> None:
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run(text)
    run.font.size = Pt(11)
    run.font.color.rgb = RGBColor(0x33, 0x33, 0x33)
    run.font.name = "微软雅黑"
    run._element.rPr.rFonts.set(qn("w:eastAsia"), "微软雅黑")


def add_contact(doc: Document, lines: list[str]) -> None:
    for line in lines:
        p = doc.add_paragraph(line)
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        for run in p.runs:
            run.font.size = Pt(10)
            run.font.name = "微软雅黑"
            run._element.rPr.rFonts.set(qn("w:eastAsia"), "微软雅黑")


def add_section(doc: Document, title: str) -> None:
    p = doc.add_paragraph()
    run = p.add_run(title)
    run.bold = True
    run.font.size = Pt(12)
    run.font.color.rgb = RGBColor(0x1A, 0x56, 0x8E)
    run.font.name = "微软雅黑"
    run._element.rPr.rFonts.set(qn("w:eastAsia"), "微软雅黑")


def add_body(doc: Document, text: str) -> None:
    p = doc.add_paragraph(text)
    for run in p.runs:
        run.font.size = Pt(10.5)
        run.font.name = "微软雅黑"
        run._element.rPr.rFonts.set(qn("w:eastAsia"), "微软雅黑")


def add_bullets(doc: Document, items: list[str]) -> None:
    for item in items:
        p = doc.add_paragraph(item, style="List Bullet")
        for run in p.runs:
            run.font.size = Pt(10.5)
            run.font.name = "微软雅黑"
            run._element.rPr.rFonts.set(qn("w:eastAsia"), "微软雅黑")


def add_project(
    doc: Document,
    name: str,
    meta: str,
    business: str,
    bullets: list[str],
) -> None:
    p = doc.add_paragraph()
    r1 = p.add_run(name)
    r1.bold = True
    r1.font.size = Pt(11)
    r1.font.name = "微软雅黑"
    r1._element.rPr.rFonts.set(qn("w:eastAsia"), "微软雅黑")
    r2 = p.add_run(f"  {meta}")
    r2.font.size = Pt(10)
    r2.italic = True
    r2.font.name = "微软雅黑"
    r2._element.rPr.rFonts.set(qn("w:eastAsia"), "微软雅黑")
    add_body(doc, f"业务背景：{business}")
    add_bullets(doc, bullets)


# ---------- 共享片段 ----------

CONTACT = [
    "电话：13002860228",
    "邮箱：yoee.chan.yy@gmail.com",
    "所在地：深圳 / 成都",
    f"工作年限：{WORK_YEARS}",
    "学历：本科（西昌学院 · 计算机科学与技术 · 2022）",
]

COMPANY = (
    "友邦创新科技（2022.09 — 至今）\n"
    "世界五百强旗下亚太区科技公司，业务覆盖香港、新加坡、马来西亚、泰国等保险金融科技场景。"
)

YOLK_BUSINESS = (
    "将开源 Agent 能力产品化为可安装的本地办公自动化桌面应用（Windows）。"
    "用户自选大模型与 MCP，在授权工作区内完成邮件、Jira、文档/表格等任务；"
    "通过连接器对接外部系统，实现可管控的流程自动化。"
)

YOLK_BULLETS = [
    "产品架构：独立设计 Electron + React 前端与 Python 双进程后端（agent_stream 流式 Agent / agent_tools 配置服务）；"
    "设计 stdin/stdout JSON 行 IPC（流式输出、need_input、need_plan_confirm），解决编码与 stdin 竞争卡死，交付 Windows 安装包。",
    "Agent 运行时：基于 OpenManus 扩展 Manus（ReAct + Tool Calling）；集成 Python 执行、文件编辑、浏览器自动化、Docker 沙箱、MCP 动态工具；"
    "支持多 LLM 提供商（OpenAI 兼容 / Azure / Bedrock）与重试、Token 管控。",
    "人机协同与安全：「先计划、后执行」—— 用户审阅计划后再执行工具链；workspace.json 限定工作区读写，降低越权风险。",
    "配置平台：Setting 子系统（Factory + Repository + Validator + Registry）统一管理 Workspace、MCP、LLM、Jira 连接器、风险策略；"
    "Jira OAuth 2.0（PKCE）+ Fernet 本地加密；Skill 以 JSON Manifest 扩展。",
    "工程化：PyInstaller + electron-builder 打包；配置与可执行文件分离；pytest 覆盖 Setting 与核心逻辑。",
]

CASHFLOW_BUSINESS = (
    "友邦亚太区资金管理业务：处理保单/投资相关的现金流（Cashflow）数据，"
    "将各渠道交易流水清洗、换算、汇总后，按监管与下游系统要求生成标准文件，"
    "经 SFTP 提供给其他团队并上传至彭博（Bloomberg, BBG）等外部平台。"
    "本项目为团队 0→1 新业务线，横向打通本团队与外部团队流程。"
)

CASHFLOW_BULLETS = [
    "角色：核心技术负责人之一，负责方案设计、核心 Python 开发及与 Leader、财务/运营等多部门评审对齐。",
    "阶段一（按月）：业务用户上传 Excel 交易流水 → 解析关键字段、多币种换算为美元 → 生成监管/内控用 Excel 报表与汇总表。",
    "阶段二至八（按日）：自动抓取业务邮箱附件中的现金流流水 → 按业务规则聚合、分组 → 生成 INC 标准文件 → "
    "上传 SFTP → 触发下游团队逻辑并最终对接 BBG。",
    "技术实现：Python 清洗多形态 Excel、pandas 聚合分类、入库 SQL Server、React 前端展示处理状态与结果；"
    "环队列算法保障 SFTP 上传顺序与重试。",
    "业务价值：从 0 搭建流水线与基础设施，减少人工对账，支撑团队新业务与收入增长。",
]

AML_BUSINESS = (
    "反洗钱（AML）合规中间服务：保险客户在确认保单前，需通过本系统对投保人/受益人等进行黑名单筛查。"
    "名单分为个人与组织（含普通纳税人、政府官员、公司高管等类别）。"
    "系统对接上游业务与第三方筛查平台，提供 API 查询与 Blob Storage 文件批处理两种通路，并对个人信息加解密。"
)

AML_BULLETS_MAINTENANCE = [
    "日常工作：承接业务方新需求（名单规则变更、接口字段、批处理逻辑等），完成功能开发与联调上线。",
    "线上保障：生产问题排查（Troubleshooting）—— 结合 Kafka 消费位点、应用日志、SQL Server Bin-log、ES 日志定位慢 SQL、"
    "消息积压、重复消费、接口超时等问题，配合运维与业务快速恢复。",
    "功能升级：在既有架构上优化查询性能、批处理稳定性及异常告警（Event Bus 邮件通知）等。",
    "技术栈：Spring Boot、Kafka、Redis、MyBatis、K8s、Docker、SFTP、Blob Storage。",
]

AML_BULLETS_FULL = AML_BULLETS_MAINTENANCE + [
    "架构理解：Kafka 集成 Middle Server 与第三方 AML 平台；定时扫描 Blob Storage 文件，异步入库；"
    "多线程 + 缓存提升高并发查询；内存池降低 GC，LRU 本地缓存保障线程安全。",
    "历史贡献：参与线程池/连接池调优、缓存与实体开发、Topic 限流与索引优化，提升吞吐量与消息处理稳定性。",
]

INTERN_BUSINESS = (
    "烟草行业生产数据采集系统：管理牌号、物理/安全卫生/工艺等指标，生成检测与巡检报表。"
)

INTERN_BULLETS = [
    "参与需求调研、原型与文档；负责牌号管理、指标管理、报表导出与计算、滤棒指标统计图等模块。",
    "使用哨兵模式对比前后端数据变更；规避 HashMap 并发问题并对计算逻辑解耦。",
    "按期完成收尾与 Bug 修复，项目成功上线。",
]

CERTS = [
    "微软云原生开发专家徽章",
    "大学英语四级（CET-4），可阅读英文技术文档",
]

SELF_AGENT = (
    "自驱力强，独立推进 Yolk 等 side project；具备 Owner 意识与产品思维，"
    "能在业务价值与技术可行性间平衡；跨团队沟通经验丰富。"
)

SELF_JAVA = (
    "扎实的 Java/Spring 与 Kafka 中间件经验，熟悉金融业务场景；"
    "擅长新需求交付与线上 Troubleshooting；沟通协作能力强，能独立推进复杂任务。"
)


def build_agent_resume() -> Document:
    doc = Document()
    set_doc_font(doc)
    add_title(doc, "陈永义")
    add_subtitle(doc, "AI Agent 开发工程师")
    add_contact(doc, CONTACT + ["求职方向：AI Agent 开发工程师"])
    doc.add_paragraph()

    add_section(doc, "个人简介")
    add_body(
        doc,
        "5 年研发经验（含 1 年实习），专注 AI Agent 工程化落地。"
        "独立设计并交付本地可安装 Agent 桌面产品 Yolk（Electron + Python），"
        "覆盖 ReAct 运行时、MCP、连接器、人机协同与安全治理、Windows 安装包发布全链路。"
        "兼具 Python 数据处理与 Java 中间件背景，适应金融级合规与跨团队协作场景。",
    )

    add_section(doc, "核心技能")
    add_bullets(
        doc,
        [
            "AI Agent：ReAct / Tool Calling、OpenManus、MCP、RAG、Prompt 工程、多模型接入（OpenAI 兼容 / Azure / Bedrock）",
            "Python：asyncio、Pydantic、FastAPI、OpenAI SDK、Playwright / browser-use、pytest、PyInstaller",
            "桌面/前端：Electron、React、TypeScript、stdin/stdout IPC、electron-builder",
            "安全治理：工作区沙箱、计划确认后执行、Fernet 加密、OAuth 2.0（Jira）",
            "熟悉：Spring Boot、Kafka、Redis（金融业务中间件经验，可作系统联调支撑）",
        ],
    )

    add_section(doc, "工作经历")
    add_body(doc, COMPANY)

    add_section(doc, "项目经历")

    add_project(
        doc,
        "Yolk — 本地化 AI Agent 桌面产品（Windows）【独立设计】",
        "Python · Electron · React · MCP · FastAPI · 2024 — 至今",
        YOLK_BUSINESS,
        YOLK_BULLETS,
    )

    add_project(
        doc,
        "Cashflow Transfer Portal（简述）",
        "Python · React · 2023.04 — 2024.08",
        CASHFLOW_BUSINESS,
        [
            "0→1 负责现金流数据处理流水线核心开发（Excel 清洗、多币种汇总、SFTP/BBG 对接），体现复杂业务数据处理与跨部门推进能力。",
        ],
    )

    add_project(
        doc,
        "AML 服务中间件（简述）",
        "Spring Boot · Kafka · 2024.08 — 至今",
        AML_BUSINESS,
        [
            "参与金融合规中间服务开发与线上保障，熟悉 Kafka 集成与高并发查询场景（面试可结合 Yolk 的连接器/安全设计展开）。",
        ],
    )

    add_project(
        doc,
        "实习：烟草数据采集",
        "Java · Spring Boot · Vue · 2021.11 — 2022.08",
        INTERN_BUSINESS,
        INTERN_BULLETS[:2],
    )

    add_section(doc, "教育背景")
    add_body(doc, "西昌学院 · 计算机科学与技术 · 本科 · 2022")

    add_section(doc, "证书与语言")
    add_bullets(doc, CERTS)

    add_section(doc, "自我评价")
    add_body(doc, SELF_AGENT)

    return doc


def build_java_resume() -> Document:
    doc = Document()
    set_doc_font(doc)
    add_title(doc, "陈永义")
    add_subtitle(doc, "Java 开发工程师 / 中间件")
    add_contact(doc, CONTACT + ["求职方向：Java 开发工程师（中间件 / 业务后端）"])
    doc.add_paragraph()

    add_section(doc, "个人简介")
    add_body(
        doc,
        "5 年研发经验（含 1 年实习），主攻 Java 业务后端与 Kafka 中间件。"
        "在保险金融科技场景负责反洗钱（AML）合规服务日常需求、线上问题排查与功能升级；"
        "曾 0→1 主导现金流（Cashflow）数据处理平台核心开发。"
        "熟悉 Spring 生态、消息队列集成、高并发优化及跨部门业务协作；"
        "同时具备 Python 数据处理与 AI Agent 桌面产品（Yolk）独立开发经验。",
    )

    add_section(doc, "核心技能")
    add_bullets(
        doc,
        [
            "Java：集合、IO/NIO、并发、JVM（类加载、JMM、GC 调优基础）",
            "Spring：Spring Boot、MyBatis、AOP、拦截器链、Bean 生命周期",
            "中间件：Kafka（生产/消费、事务、幂等、积压排查）、Redis、SQL Server / MySQL（索引、慢 SQL）",
            "工程化：Docker、K8s、CI/CD、Git、Maven、Jira",
            "数据处理：Python、pandas、Excel 清洗入库（Cashflow 项目）",
            "前端协作：Vue / React（能独立完成联调与简单页面）",
        ],
    )

    add_section(doc, "工作经历")
    add_body(doc, COMPANY)

    add_section(doc, "项目经历")

    add_project(
        doc,
        "AML 服务中间件",
        "Spring Boot · Kafka · Redis · MyBatis · K8s · 2024.08 — 至今",
        AML_BUSINESS,
        AML_BULLETS_MAINTENANCE,
    )

    add_project(
        doc,
        "Cashflow Transfer Portal",
        "Python · React · SQL Server · 2023.04 — 2024.08",
        CASHFLOW_BUSINESS,
        CASHFLOW_BULLETS,
    )

    add_project(
        doc,
        "Yolk — 本地化 AI Agent 桌面产品（个人项目）",
        "Python · Electron · Java 中间件经验可迁移 · 2024 — 至今",
        YOLK_BUSINESS,
        [
            "独立 side project，展示全栈与工程化能力；技术栈与主业互补（详见 AI Agent 版简历或面试补充）。",
        ],
    )

    add_project(
        doc,
        "实习：烟草数据采集",
        "Java · Spring Boot · Vue · MySQL · 2021.11 — 2022.08",
        INTERN_BUSINESS,
        INTERN_BULLETS,
    )

    add_section(doc, "教育背景")
    add_body(doc, "西昌学院 · 计算机科学与技术 · 本科 · 2022")

    add_section(doc, "证书与语言")
    add_bullets(doc, CERTS)

    add_section(doc, "自我评价")
    add_body(doc, SELF_JAVA)

    return doc


def main() -> None:
    out_dir = r"c:\Users\yoeec\Documents\project\frontend\yolk"
    agent_path = f"{out_dir}\\陈永义简历-AI-Agent.docx"
    java_path = f"{out_dir}\\陈永义简历-Java中间件.docx"

    build_agent_resume().save(agent_path)
    build_java_resume().save(java_path)
    print(f"已生成: {agent_path}")
    print(f"已生成: {java_path}")


if __name__ == "__main__":
    main()
