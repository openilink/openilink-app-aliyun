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

  return handlers;
}

/** CDN Tool 模块 */
export const cdnTools: ToolModule = { definitions, createHandlers };
