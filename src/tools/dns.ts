/**
 * DNS 域名解析 Tools
 * 提供域名列表、解析记录列出、添加、删除能力
 */
import type { AliyunClient } from "../aliyun/client.js";
import type { ToolDefinition, ToolHandler } from "../hub/types.js";
import type { ToolModule } from "./index.js";

/** DNS 模块 tool 定义列表 */
const definitions: ToolDefinition[] = [
  {
    name: "list_domains",
    description: "列出所有域名",
    command: "list_domains",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "list_dns_records",
    description: "列出域名的 DNS 解析记录",
    command: "list_dns_records",
    parameters: {
      type: "object",
      properties: {
        domain: { type: "string", description: "域名，如 example.com" },
      },
      required: ["domain"],
    },
  },
  {
    name: "add_dns_record",
    description: "添加 DNS 解析记录",
    command: "add_dns_record",
    parameters: {
      type: "object",
      properties: {
        domain: { type: "string", description: "域名，如 example.com" },
        rr: { type: "string", description: "主机记录，如 www、@、mail" },
        type: { type: "string", description: "记录类型: A / CNAME / MX / TXT / AAAA 等" },
        value: { type: "string", description: "记录值，如 IP 地址或 CNAME 目标" },
      },
      required: ["domain", "rr", "type", "value"],
    },
  },
  {
    name: "delete_dns_record",
    description: "删除 DNS 解析记录",
    command: "delete_dns_record",
    parameters: {
      type: "object",
      properties: {
        record_id: { type: "string", description: "解析记录 ID" },
      },
      required: ["record_id"],
    },
  },
];

/** 创建 DNS 模块的 handler 映射 */
function createHandlers(client: AliyunClient): Map<string, ToolHandler> {
  const handlers = new Map<string, ToolHandler>();

  // 列出域名
  handlers.set("list_domains", async () => {
    try {
      const res = await client.request("alidns.aliyuncs.com", "DescribeDomains", {
        PageSize: "50",
      });
      const domains = res.Domains?.Domain ?? [];

      if (domains.length === 0) {
        return "暂无域名";
      }

      const lines = domains.map((d: any, i: number) => {
        const recordCount = d.RecordCount ?? 0;
        return `${i + 1}. ${d.DomainName} | 解析记录数: ${recordCount} | DNS: ${d.DnsServers?.DnsServer?.join(", ") ?? "未知"}`;
      });

      return `域名列表（共 ${domains.length} 个）:\n${lines.join("\n")}`;
    } catch (err: any) {
      return `列出域名失败: ${err.message ?? err}`;
    }
  });

  // 列出解析记录
  handlers.set("list_dns_records", async (ctx) => {
    const domain: string = ctx.args.domain ?? "";

    try {
      const res = await client.request("alidns.aliyuncs.com", "DescribeDomainRecords", {
        DomainName: domain,
        PageSize: "100",
      });
      const records = res.DomainRecords?.Record ?? [];

      if (records.length === 0) {
        return `域名 ${domain} 暂无解析记录`;
      }

      const lines = records.map((r: any, i: number) => {
        const status = r.Status === "ENABLE" ? "启用" : "暂停";
        return `${i + 1}. ${r.RR}.${domain} → ${r.Value}\n   类型: ${r.Type} | TTL: ${r.TTL} | 状态: ${status} | ID: ${r.RecordId}`;
      });

      return `${domain} 解析记录（共 ${records.length} 条）:\n${lines.join("\n")}`;
    } catch (err: any) {
      return `列出解析记录失败: ${err.message ?? err}`;
    }
  });

  // 添加解析记录
  handlers.set("add_dns_record", async (ctx) => {
    const domain: string = ctx.args.domain ?? "";
    const rr: string = ctx.args.rr ?? "";
    const type: string = ctx.args.type ?? "";
    const value: string = ctx.args.value ?? "";

    try {
      const res = await client.request("alidns.aliyuncs.com", "AddDomainRecord", {
        DomainName: domain,
        RR: rr,
        Type: type,
        Value: value,
      });

      return `解析记录添加成功!\n${rr}.${domain} → ${value}\n类型: ${type}\n记录 ID: ${res.RecordId}`;
    } catch (err: any) {
      return `添加解析记录失败: ${err.message ?? err}`;
    }
  });

  // 删除解析记录
  handlers.set("delete_dns_record", async (ctx) => {
    const recordId: string = ctx.args.record_id ?? "";

    try {
      await client.request("alidns.aliyuncs.com", "DeleteDomainRecord", {
        RecordId: recordId,
      });
      return `解析记录 ${recordId} 已删除`;
    } catch (err: any) {
      return `删除解析记录失败: ${err.message ?? err}`;
    }
  });

  return handlers;
}

/** DNS Tool 模块 */
export const dnsTools: ToolModule = { definitions, createHandlers };
