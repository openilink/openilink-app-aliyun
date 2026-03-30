/**
 * CDN 内容分发 Tools
 * 提供 CDN 域名列出、缓存刷新、预热能力
 */
import type { AliyunClient } from "../aliyun/client.js";
import type { ToolDefinition, ToolHandler } from "../hub/types.js";
import type { ToolModule } from "./index.js";

/** CDN 模块 tool 定义列表 */
const definitions: ToolDefinition[] = [
  {
    name: "list_cdn_domains",
    description: "列出 CDN 加速域名",
    command: "list_cdn_domains",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "refresh_cdn",
    description: "刷新 CDN 缓存",
    command: "refresh_cdn",
    parameters: {
      type: "object",
      properties: {
        urls: {
          type: "string",
          description: "要刷新的 URL 列表，多个用逗号或换行分隔",
        },
      },
      required: ["urls"],
    },
  },
  {
    name: "preload_cdn",
    description: "CDN 资源预热",
    command: "preload_cdn",
    parameters: {
      type: "object",
      properties: {
        urls: {
          type: "string",
          description: "要预热的 URL 列表，多个用逗号或换行分隔",
        },
      },
      required: ["urls"],
    },
  },
  {
    name: "get_cdn_domain_detail",
    description: "获取 CDN 加速域名详情",
    command: "get_cdn_domain_detail",
    parameters: {
      type: "object",
      properties: {
        domain: { type: "string", description: "CDN 加速域名" },
      },
      required: ["domain"],
    },
  },
  {
    name: "get_cdn_usage",
    description: "查询 CDN 域名用量数据（带宽或流量）",
    command: "get_cdn_usage",
    parameters: {
      type: "object",
      properties: {
        domain: { type: "string", description: "CDN 加速域名" },
        start_time: { type: "string", description: "开始时间，ISO 格式如 2024-01-01T00:00:00Z" },
        end_time: { type: "string", description: "结束时间，ISO 格式如 2024-01-02T00:00:00Z" },
        field: { type: "string", description: "查询字段: bps(带宽) 或 traf(流量)，默认 bps" },
      },
      required: ["domain", "start_time", "end_time"],
    },
  },
];

/** 将逗号或换行分隔的 URL 字符串转为换行分隔 */
function normalizeUrls(input: string): string {
  return input
    .split(/[,\n]+/)
    .map((u) => u.trim())
    .filter(Boolean)
    .join("\n");
}

/** 创建 CDN 模块的 handler 映射 */
function createHandlers(client: AliyunClient): Map<string, ToolHandler> {
  const handlers = new Map<string, ToolHandler>();

  // 列出 CDN 域名
  handlers.set("list_cdn_domains", async () => {
    try {
      const res = await client.request("cdn.aliyuncs.com", "DescribeUserDomains", {
        PageSize: "50",
      });
      const domains = res.Domains?.PageData ?? [];

      if (domains.length === 0) {
        return "暂无 CDN 加速域名";
      }

      const lines = domains.map((d: any, i: number) => {
        const status = d.DomainStatus ?? "未知";
        const cname = d.Cname ?? "无";
        return `${i + 1}. ${d.DomainName} [${status}]\n   CNAME: ${cname} | 源站: ${d.Sources?.Source?.[0]?.Content ?? "未知"}`;
      });

      return `CDN 域名列表（共 ${domains.length} 个）:\n${lines.join("\n")}`;
    } catch (err: any) {
      return `列出 CDN 域名失败: ${err.message ?? err}`;
    }
  });

  // 刷新 CDN 缓存
  handlers.set("refresh_cdn", async (ctx) => {
    const urlsInput: string = ctx.args.urls ?? "";
    const objectPath = normalizeUrls(urlsInput);

    if (!objectPath) {
      return "请提供要刷新的 URL";
    }

    try {
      const res = await client.request("cdn.aliyuncs.com", "RefreshObjectCaches", {
        ObjectPath: objectPath,
        ObjectType: "File",
      });
      return `CDN 缓存刷新任务已提交!\n任务 ID: ${res.RefreshTaskId}\n刷新 URL:\n${objectPath}`;
    } catch (err: any) {
      return `CDN 缓存刷新失败: ${err.message ?? err}`;
    }
  });

  // 预热 CDN 资源
  handlers.set("preload_cdn", async (ctx) => {
    const urlsInput: string = ctx.args.urls ?? "";
    const objectPath = normalizeUrls(urlsInput);

    if (!objectPath) {
      return "请提供要预热的 URL";
    }

    try {
      const res = await client.request("cdn.aliyuncs.com", "PushObjectCache", {
        ObjectPath: objectPath,
      });
      return `CDN 预热任务已提交!\n任务 ID: ${res.PushTaskId}\n预热 URL:\n${objectPath}`;
    } catch (err: any) {
      return `CDN 预热失败: ${err.message ?? err}`;
    }
  });

  // 获取 CDN 域名详情
  handlers.set("get_cdn_domain_detail", async (ctx) => {
    const domain: string = ctx.args.domain ?? "";

    try {
      const res = await client.request("cdn.aliyuncs.com", "DescribeCdnDomainDetail", {
        DomainName: domain,
      });
      const detail = res.GetDomainDetailModel ?? {};

      const sources = detail.SourceModels?.SourceModel ?? [];
      const sourceLines = sources.map((s: any) => `${s.Content} (${s.Type ?? "未知"}, 端口: ${s.Port ?? "未知"})`).join(", ");

      const lines = [
        `域名: ${detail.DomainName ?? domain}`,
        `状态: ${detail.DomainStatus ?? "未知"}`,
        `CNAME: ${detail.Cname ?? "无"}`,
        `CDN 类型: ${detail.CdnType ?? "未知"}`,
        `源站: ${sourceLines || "无"}`,
        `HTTPS: ${detail.ServerCertificateStatus === "on" ? "已开启" : "未开启"}`,
        `区域: ${detail.Scope ?? "未知"}`,
        `创建时间: ${detail.GmtCreated ?? "未知"}`,
        `修改时间: ${detail.GmtModified ?? "未知"}`,
      ];

      return lines.join("\n");
    } catch (err: any) {
      return `获取 CDN 域名详情失败: ${err.message ?? err}`;
    }
  });

  // 查询 CDN 用量数据
  handlers.set("get_cdn_usage", async (ctx) => {
    const domain: string = ctx.args.domain ?? "";
    const startTime: string = ctx.args.start_time ?? "";
    const endTime: string = ctx.args.end_time ?? "";
    const field: string = ctx.args.field ?? "bps";

    try {
      const res = await client.request("cdn.aliyuncs.com", "DescribeDomainUsageData", {
        DomainName: domain,
        StartTime: startTime,
        EndTime: endTime,
        Field: field,
      });

      const entries = res.UsageDataPerInterval?.DataModule ?? [];
      if (entries.length === 0) {
        return `域名 ${domain} 在指定时间段内无用量数据`;
      }

      const fieldLabel = field === "traf" ? "流量" : "带宽";
      const unit = field === "traf" ? "bytes" : "bps";

      const lines = entries.slice(0, 24).map((e: any) => {
        return `  ${e.TimeStamp}: ${e.Value} ${unit}`;
      });

      let result = `${domain} ${fieldLabel}用量（${startTime} ~ ${endTime}）:\n${lines.join("\n")}`;
      if (entries.length > 24) {
        result += `\n... 共 ${entries.length} 条，仅显示前 24 条`;
      }

      return result;
    } catch (err: any) {
      return `查询 CDN 用量失败: ${err.message ?? err}`;
    }
  });

  return handlers;
}

/** CDN Tool 模块 */
export const cdnTools: ToolModule = { definitions, createHandlers };
