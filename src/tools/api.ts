/**
 * 通用阿里云 API 调用工具
 * 可以调用任意阿里云 RPC 风格 OpenAPI，覆盖预置工具未支持的 600+ 服务。
 * 底层复用 AliyunClient.request() 方法，自动处理签名和认证。
 */
import type { AliyunClient } from "../aliyun/client.js";
import type { ToolDefinition, ToolHandler } from "../hub/types.js";
import type { ToolModule } from "./index.js";

/** 通用 API 工具定义 */
const definitions: ToolDefinition[] = [
  {
    name: "aliyun_api",
    description:
      "通用阿里云 OpenAPI 调用 — 可以调用任意阿里云 RPC 风格 API。" +
      "传入 endpoint、Action 和参数即可。支持 ECS、RDS、SLB、CDN、OSS 等 600+ 服务的所有 API。" +
      "常见 endpoint 示例：ecs.aliyuncs.com、rds.aliyuncs.com、cdn.aliyuncs.com、" +
      "slb.aliyuncs.com、vpc.aliyuncs.com、alidns.aliyuncs.com。",
    command: "aliyun_api",
    parameters: {
      type: "object",
      properties: {
        endpoint: {
          type: "string",
          description:
            "API 端点域名，如 ecs.aliyuncs.com、rds.aliyuncs.com、cdn.aliyuncs.com",
        },
        action: {
          type: "string",
          description: "API Action 名称，如 DescribeInstances、CreateDBInstance",
        },
        params: {
          type: "string",
          description:
            '请求参数 JSON 字符串，如 {"RegionId":"cn-hangzhou","PageSize":"10"}',
        },
        version: {
          type: "string",
          description:
            "API 版本号（可选，常见服务会自动匹配版本）",
        },
        method: {
          type: "string",
          description: "HTTP 方法：GET 或 POST，默认 GET",
        },
      },
      required: ["endpoint", "action"],
    },
  },
];

/** 创建通用 API 工具的 handler 映射 */
function createHandlers(client: AliyunClient): Map<string, ToolHandler> {
  const handlers = new Map<string, ToolHandler>();

  handlers.set("aliyun_api", async (ctx) => {
    const endpoint = ctx.args.endpoint as string;
    const action = ctx.args.action as string;
    const paramsStr = ctx.args.params as string | undefined;
    const version = ctx.args.version as string | undefined;
    const method = ((ctx.args.method as string) || "GET").toUpperCase();

    // 校验必填参数
    if (!endpoint || !action) {
      return "缺少必填参数: endpoint 和 action 均为必填";
    }

    // 解析可选的请求参数
    let params: Record<string, string> = {};
    if (paramsStr) {
      try {
        const parsed = JSON.parse(paramsStr);
        // 将所有值转为字符串（阿里云 API 参数均为字符串类型）
        for (const [key, value] of Object.entries(parsed)) {
          params[key] = String(value);
        }
      } catch {
        return `params 参数不是合法的 JSON: ${paramsStr}`;
      }
    }

    // 如果指定了版本号，注入到参数中（会覆盖 client 自动匹配的版本）
    if (version) {
      params.Version = version;
    }

    try {
      const data = await client.request(endpoint, action, params, method);

      // 格式化输出并限制长度，防止消息过长
      const text = JSON.stringify(data, null, 2);
      if (text.length > 4000) {
        return text.slice(0, 4000) + "\n... (内容已截断，共 " + text.length + " 字符)";
      }
      return text;
    } catch (err: any) {
      return `阿里云 API 调用失败: ${err.message ?? err}`;
    }
  });

  return handlers;
}

/** 通用 API 工具模块 */
export const apiTools: ToolModule = { definitions, createHandlers };
