/**
 * 域名注册 Tools
 * 提供注册域名列出、域名详情查看能力
 */
import type { AliyunClient } from "../aliyun/client.js";
import type { ToolDefinition, ToolHandler } from "../hub/types.js";
import type { ToolModule } from "./index.js";

/** 域名注册模块 tool 定义列表 */
const definitions: ToolDefinition[] = [
  {
    name: "list_registered_domains",
    description: "列出已注册的域名",
    command: "list_registered_domains",
    parameters: {
      type: "object",
      properties: {
        page: {
          type: "string",
          description: "页码，默认 1",
        },
      },
    },
  },
  {
    name: "get_domain_info",
    description: "获取注册域名详情",
    command: "get_domain_info",
    parameters: {
      type: "object",
      properties: {
        instance_id: { type: "string", description: "域名实例 ID" },
      },
      required: ["instance_id"],
    },
  },
];

/** 创建域名注册模块的 handler 映射 */
function createHandlers(client: AliyunClient): Map<string, ToolHandler> {
  const handlers = new Map<string, ToolHandler>();

  // 列出注册域名
  handlers.set("list_registered_domains", async (ctx) => {
    const page = (ctx.args.page as string) || "1";

    try {
      const res = await client.request("domain.aliyuncs.com", "QueryDomainList", {
        PageNum: page,
        PageSize: "50",
      });
      const domains = res.Data?.Domain ?? [];

      if (domains.length === 0) {
        return "暂无已注册的域名";
      }

      const lines = domains.map((d: any, i: number) => {
        const expiry = d.ExpirationDate ?? "未知";
        const status = d.DomainStatus ?? "未知";
        return `${i + 1}. ${d.DomainName} [${status}]\n   实例ID: ${d.InstanceId} | 注册时间: ${d.RegistrationDate ?? "未知"} | 到期时间: ${expiry}`;
      });

      const total = res.TotalItemNum ?? domains.length;
      return `已注册域名列表（共 ${total} 个，第 ${page} 页）:\n${lines.join("\n")}`;
    } catch (err: any) {
      return `列出注册域名失败: ${err.message ?? err}`;
    }
  });

  // 获取域名详情
  handlers.set("get_domain_info", async (ctx) => {
    const instanceId: string = ctx.args.instance_id ?? "";

    try {
      const res = await client.request("domain.aliyuncs.com", "QueryDomainByInstanceId", {
        InstanceId: instanceId,
      });

      const lines = [
        `域名: ${res.DomainName ?? "未知"}`,
        `实例 ID: ${res.InstanceId ?? instanceId}`,
        `注册商: ${res.ZhRegistrantOrganization ?? res.RegistrantOrganization ?? "未知"}`,
        `联系人: ${res.ZhRegistrantName ?? res.RegistrantName ?? "未知"}`,
        `邮箱: ${res.Email ?? "未知"}`,
        `注册时间: ${res.RegistrationDate ?? "未知"}`,
        `到期时间: ${res.ExpirationDate ?? "未知"}`,
        `DNS 服务器: ${res.DnsList?.Dns?.join(", ") ?? "未知"}`,
        `实名认证: ${res.DomainNameVerificationStatus === "SUCCEED" ? "已通过" : "未通过"}`,
        `域名状态: ${res.DomainStatus ?? "未知"}`,
      ];

      return lines.join("\n");
    } catch (err: any) {
      return `获取域名详情失败: ${err.message ?? err}`;
    }
  });

  return handlers;
}

/** 域名注册 Tool 模块 */
export const domainTools: ToolModule = { definitions, createHandlers };
