# OpeniLink 阿里云 App

管理阿里云资源 — 22 个工具，覆盖 ECS / DNS / CDN / SSL / SLB / 安全组 / 账单。

## 功能概览

### ECS 云服务器 (5 Tools)
- `list_instances` - 列出 ECS 实例
- `get_instance` - 获取实例详情
- `start_instance` - 启动实例
- `stop_instance` - 停止实例
- `reboot_instance` - 重启实例

### DNS 域名解析 (4 Tools)
- `list_domains` - 列出域名
- `list_dns_records` - 列出解析记录
- `add_dns_record` - 添加解析记录
- `delete_dns_record` - 删除解析记录

### CDN 内容分发 (3 Tools)
- `list_cdn_domains` - 列出 CDN 域名
- `refresh_cdn` - 刷新缓存
- `preload_cdn` - 预热资源

### SSL 证书 (2 Tools)
- `list_certificates` - 列出 SSL 证书
- `get_certificate` - 证书详情

### SLB 负载均衡 (3 Tools)
- `list_load_balancers` - 列出负载均衡
- `get_lb_info` - 实例详情
- `list_listeners` - 列出监听

### 安全组 (2 Tools)
- `list_security_groups` - 列出安全组
- `get_security_group_rules` - 查看安全组规则

### 账单费用 (3 Tools)
- `get_balance` - 查询余额
- `list_bills` - 账单列表
- `get_monthly_cost` - 月度费用汇总

## 快速开始

```bash
# 安装依赖
npm install

# 设置环境变量
export HUB_URL=http://your-hub-url
export BASE_URL=http://your-app-url
export ALIYUN_ACCESS_KEY_ID=your_access_key_id
export ALIYUN_ACCESS_KEY_SECRET=your_access_key_secret

# 开发模式
npm run dev

# 构建并运行
npm run build
npm start
```

## Docker 部署

```bash
docker compose up -d
```

## 认证方式

使用阿里云 AccessKey ID + AccessKey Secret 进行签名认证（RPC 风格 HMAC-SHA1 签名）。

> 建议使用 RAM 子账号的 AccessKey，避免使用主账号 AccessKey。

## 环境变量

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `HUB_URL` | 是 | - | OpeniLink Hub 地址 |
| `BASE_URL` | 是 | - | 本 App 公网地址 |
| `ALIYUN_ACCESS_KEY_ID` | 是 | - | 阿里云 AccessKey ID |
| `ALIYUN_ACCESS_KEY_SECRET` | 是 | - | 阿里云 AccessKey Secret |
| `ALIYUN_REGION` | 否 | cn-hangzhou | 默认区域 |
| `PORT` | 否 | 8100 | HTTP 监听端口 |
| `DB_PATH` | 否 | data/aliyun.db | SQLite 数据库路径 |

## 安全与隐私

### 数据处理说明

- **无状态工具**：本 App 为纯工具型应用，请求即响应，**不存储任何用户数据**
- **第三方 API 调用**：您的请求会通过阿里云 OpenAPI 处理
- **AccessKey 安全**：您的 AccessKey 仅存储在服务端环境变量或 Installation 配置中

### 自部署（推荐注重隐私的用户）

```bash
docker compose up -d
```

自部署后 AccessKey 和所有请求数据仅在您自己的服务器上。

## License

MIT
