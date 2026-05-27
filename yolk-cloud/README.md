# yolk-cloud

Yolk 云端后端：用户登录、词元流量管理、充值订单（Spring Boot 3 + MyBatis + MySQL）。

## 模块

| 包 | 职责 |
|----|------|
| `com.yolk.auth` | 注册、登录、JWT、`/api/auth/me` |
| `com.yolk.traffic` | 当前套餐、加量包目录、用量曲线、日限额 |
| `com.yolk.order` | 充值下单、订单查询、模拟支付到账 |

## 环境要求

- JDK 17+
- Maven 3.9+
- MySQL 8+

## 初始化数据库

推荐一次性导入完整库表与种子数据（含 `phone`、`avatar_url` 字段）：

```powershell
cd yolk-cloud
mysql -u root -p < sql/import_yolk.sql
```

也可仅建库，由 Flyway 迁移（`src/main/resources/db/migration`，默认已开启）。

**若登录后聊天报 500、无法创建任务**：多半是旧库缺少 `chat_tasks` 表。任选其一：

```powershell
# 方式 A：重启 yolk-cloud（Flyway 会自动补 V4 迁移）
cd yolk-cloud
mvn spring-boot:run

# 方式 B：手动执行补丁 SQL
mysql -u root -p yolk < sql/patch_chat_tasks.sql
```

MyBatis SQL 定义在 `src/main/resources/mapper/*.xml`。

## 配置

复制并修改环境变量（或在 IDE Run Configuration 里设置）：

```powershell
$env:MYSQL_PASSWORD = "你的MySQL密码"
$env:JWT_SECRET = "至少32位的随机字符串用于签发JWT"
```

默认连接：`jdbc:mysql://localhost:3306/yolk`，用户 `root`。

## 启动

```powershell
cd yolk-cloud
mvn spring-boot:run
```

服务地址：`http://localhost:8080`

## 官网（宣传页 + 安装包下载）

静态官网已内置在 `src/main/resources/static/`，与 API **同域部署**：

| 路径 | 说明 |
|------|------|
| `/` | 产品介绍宣传页 |
| `/release.json` | 版本号、下载文件名（发版时修改） |
| `/downloads/*.exe` | Windows 安装包（需自行上传，不打进 Git） |

### 发布安装包

1. 在项目根目录打包桌面端：

```powershell
cd agent-controller
.\build_exe.bat
cd ..
npm run build:installer
```

2. 将 `dist/` 下生成的安装包复制到：

```text
yolk-cloud/src/main/resources/static/downloads/Yolk助手-Setup-1.0.0.exe
```

或在**服务器**上放到 JAR 同级目录 `downloads/`（若用 Nginx 托管大文件，见下）。

3. 更新 `static/release.json` 中的 `version`、`fileName`、`downloadUrl`。

### 生产部署建议

- **小团队 / 单机**：`java -jar yolk-cloud.jar` 即可，根路径访问官网，`/api/**` 为后端。
- **安装包较大时**：不要把 exe 打进 JAR。用 Nginx：

```nginx
location /downloads/ {
    alias /var/www/yolk/downloads/;
}
location /api/ {
    proxy_pass http://127.0.0.1:8080;
}
location / {
    proxy_pass http://127.0.0.1:8080;
}
```

`SecurityConfig` 已对非 `/api/**` 路径放行，官网与静态资源无需登录。

## API 一览

统一响应：`{ "code": 0, "message": "ok", "data": ... }`  
鉴权：除注册/登录外，请求头加 `Authorization: Bearer <token>`

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | `{ email?, phone?, password, nickname? }` 邮箱/手机二选一 |
| POST | `/api/auth/login` | `{ account, password }` account 为邮箱或手机号 |
| GET | `/api/auth/me` | 当前用户 |
| PUT | `/api/auth/profile` | `{ nickname?, avatarUrl? }` 更新头像、用户名 |
| PUT | `/api/auth/password` | `{ oldPassword, newPassword }` |

### 聊天任务

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/chat/tasks` | 任务列表 |
| POST | `/api/chat/tasks` | 创建新任务 |
| GET | `/api/chat/tasks/{id}` | 任务详情与消息 |
| POST | `/api/chat/tasks/{id}/messages` | 追加消息 |
| PUT | `/api/chat/tasks/{id}/title` | 更新标题 |
| PUT | `/api/chat/tasks/{id}/pin` | 置顶/取消置顶 |

### 流量

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/traffic/plan` | 当前套餐（对齐前端 `TokenPlan`） |
| GET | `/api/traffic/packages` | 加量包列表 |
| GET | `/api/traffic/catalog` | 套餐目录 |
| GET | `/api/traffic/usage?period=day\|week\|month` | 用量曲线 |
| GET | `/api/traffic/daily-limit` | 日限额 |
| PUT | `/api/traffic/daily-limit` | `{ dailyLimit }` |

### 订单

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/orders/recharge` | `{ packageId }` 创建充值订单 |
| GET | `/api/orders/{id}` | 订单详情 |
| GET | `/api/orders` | 订单列表 |
| POST | `/api/orders/{id}/confirm-paid` | MVP 模拟支付成功并入账词元 |

## 与 Electron 对接

在 `renderer` 中新增 HTTP 客户端，`baseURL` 指向 `http://localhost:8080`，逐步替换 `token-manage/mockData.ts`。

本地 Agent（`agent-controller` / `local-llm-engine`）保持不变，仅云端账号与计费走本服务。

## 后续扩展

- 接入微信/支付宝支付与回调
- Agent 调用时上报真实词元消耗到 `usage_records`
- 流水线任务调度（可新增 `com.yolk.pipeline` 包）
