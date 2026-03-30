/**
 * SSL 证书 Tools
 * 提供 SSL 证书列表、详情查看能力
 */
import type { AliyunClient } from "../aliyun/client.js";
import type { ToolDefinition, ToolHandler } from "../hub/types.js";
import type { ToolModule } from "./index.js";

/** SSL 模块 tool 定义列表 */
const definitions: ToolDefinition[] = [
  {
    name: "list_certificates",
    description: "列出 SSL 证书",
    command: "list_certificates",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_certificate",
    description: "获取 SSL 证书详情",
    command: "get_certificate",
    parameters: {
      type: "object",
      properties: {
        cert_id: { type: "string", description: "证书 ID" },
      },
      required: ["cert_id"],
    },
  },
];

/** 创建 SSL 模块的 handler 映射 */
function createHandlers(client: AliyunClient): Map<string, ToolHandler> {
  const handlers = new Map<string, ToolHandler>();

  // 列出 SSL 证书
  handlers.set("list_certificates", async () => {
    try {
      const res = await client.request("cas.aliyuncs.com", "ListUserCertificateOrder", {
        ShowSize: "50",
        CurrentPage: "1",
      });
      const certs = res.CertificateOrderList ?? [];

      if (certs.length === 0) {
        return "暂无 SSL 证书";
      }

      const lines = certs.map((c: any, i: number) => {
        const status = c.StatusCode ?? c.Status ?? "未知";
        const domain = c.Domain ?? c.CommonName ?? "未知";
        const expireDate = c.CertEndTime
          ? new Date(Number(c.CertEndTime)).toLocaleDateString("zh-CN")
          : "未知";
        return `${i + 1}. ${domain} [${status}]\n   证书 ID: ${c.InstanceId ?? c.CertificateId ?? "未知"} | 过期时间: ${expireDate}`;
      });

      return `SSL 证书列表（共 ${certs.length} 张）:\n${lines.join("\n")}`;
    } catch (err: any) {
      return `列出 SSL 证书失败: ${err.message ?? err}`;
    }
  });

  // 获取证书详情
  handlers.set("get_certificate", async (ctx) => {
    const certId: string = ctx.args.cert_id ?? "";

    try {
      const res = await client.request("cas.aliyuncs.com", "GetUserCertificateDetail", {
        CertId: certId,
      });

      const lines = [
        `证书名称: ${res.Name ?? "未知"}`,
        `证书 ID: ${certId}`,
        `域名: ${res.Sans ?? res.Common ?? "未知"}`,
        `签发机构: ${res.Issuer ?? "未知"}`,
        `指纹: ${res.Sha2 ?? res.Fingerprint ?? "未知"}`,
        `开始时间: ${res.StartDate ?? "未知"}`,
        `过期时间: ${res.EndDate ?? "未知"}`,
        `状态: ${res.Expired ? "已过期" : "有效"}`,
      ];

      return lines.join("\n");
    } catch (err: any) {
      return `获取证书详情失败: ${err.message ?? err}`;
    }
  });

  return handlers;
}

/** SSL Tool 模块 */
export const sslTools: ToolModule = { definitions, createHandlers };
