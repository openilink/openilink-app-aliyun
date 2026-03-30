import type { Config } from "../config.js";
import type { ToolDefinition } from "./types.js";

/** Manifest 结构（注册到 Hub 的 App 描述） */
export interface Manifest {
  slug: string;
  name: string;
  description: string;
  icon: string;
  events: string[];
  scopes: string[];
  tools: ToolDefinition[];
  oauth_setup_url: string;
  oauth_redirect_url: string;
  webhook_url: string;
  /** 配置表单 JSON Schema */
  config_schema?: Record<string, unknown>;
  /** 安装引导说明（Markdown） */
  guide?: string;
}

/**
 * 生成完整的 App Manifest，用于向 Hub 注册
 * @param config 应用配置
 * @param toolDefinitions 工具定义列表
 */
export function getManifest(
  config: Config,
  toolDefinitions: ToolDefinition[] = [],
): Manifest {
  const baseUrl = config.baseUrl;

  return {
    slug: "aliyun",
    name: "阿里云",
    description: "管理阿里云资源 — ECS / DNS / CDN / SSL / SLB / 安全组 / 账单",
    icon: "☁️",
    events: ["command"],
    scopes: ["tools:write"],
    tools: toolDefinitions,
    oauth_setup_url: `${baseUrl}/oauth/setup`,
    oauth_redirect_url: `${baseUrl}/oauth/redirect`,
    webhook_url: `${baseUrl}/hub/webhook`,
    config_schema: {
      type: "object",
      properties: {
        aliyun_access_key_id: {
          type: "string",
          title: "阿里云 AccessKey ID",
          description: "在阿里云控制台 → AccessKey 管理中创建",
        },
        aliyun_access_key_secret: {
          type: "string",
          title: "阿里云 AccessKey Secret",
          description: "创建 AccessKey 时获取的密钥",
        },
        aliyun_region: {
          type: "string",
          title: "默认区域",
          description: "阿里云区域 ID，如 cn-hangzhou、cn-beijing 等",
          default: "cn-hangzhou",
        },
      },
      required: ["aliyun_access_key_id", "aliyun_access_key_secret"],
    },
    guide:
      "## 阿里云安装指南\n### 第 1 步\n访问 [阿里云 AccessKey 管理](https://ram.console.aliyun.com/manage/ak)\n### 第 2 步\n创建或获取 AccessKey ID 和 AccessKey Secret\n### 第 3 步\n将 AccessKey 填入上方配置并安装\n\n> 建议使用 RAM 子账号的 AccessKey，避免使用主账号 AccessKey",
  };
}
