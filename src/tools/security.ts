/**
 * 安全组 Tools
 * 提供安全组列出、规则查看能力
 */
import type { AliyunClient } from "../aliyun/client.js";
import type { ToolDefinition, ToolHandler } from "../hub/types.js";
import type { ToolModule } from "./index.js";

/** 安全组模块 tool 定义列表 */
const definitions: ToolDefinition[] = [
  {
    name: "list_security_groups",
    description: "列出安全组",
    command: "list_security_groups",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_security_group_rules",
    description: "查看安全组规则",
    command: "get_security_group_rules",
    parameters: {
      type: "object",
      properties: {
        group_id: { type: "string", description: "安全组 ID" },
      },
      required: ["group_id"],
    },
  },
];

/** 创建安全组模块的 handler 映射 */
function createHandlers(client: AliyunClient): Map<string, ToolHandler> {
  const handlers = new Map<string, ToolHandler>();

  // 列出安全组
  handlers.set("list_security_groups", async () => {
    try {
      const res = await client.request("ecs.aliyuncs.com", "DescribeSecurityGroups", {
        PageSize: "50",
      });
      const groups = res.SecurityGroups?.SecurityGroup ?? [];

      if (groups.length === 0) {
        return "暂无安全组";
      }

      const lines = groups.map((g: any, i: number) => {
        const type = g.SecurityGroupType === "enterprise" ? "企业级" : "普通";
        return `${i + 1}. ${g.SecurityGroupName || g.SecurityGroupId} [${type}]\n   ID: ${g.SecurityGroupId} | VPC: ${g.VpcId ?? "经典网络"} | 描述: ${g.Description || "无"}`;
      });

      return `安全组列表（共 ${groups.length} 个）:\n${lines.join("\n")}`;
    } catch (err: any) {
      return `列出安全组失败: ${err.message ?? err}`;
    }
  });

  // 查看安全组规则
  handlers.set("get_security_group_rules", async (ctx) => {
    const groupId: string = ctx.args.group_id ?? "";

    try {
      const res = await client.request("ecs.aliyuncs.com", "DescribeSecurityGroupAttribute", {
        SecurityGroupId: groupId,
      });

      const rules = res.Permissions?.Permission ?? [];
      const groupName = res.SecurityGroupName || groupId;

      if (rules.length === 0) {
        return `安全组 ${groupName} 暂无规则`;
      }

      const lines = [`安全组: ${groupName} (${groupId})\n规则列表:`];

      rules.forEach((r: any, i: number) => {
        const direction = r.Direction === "ingress" ? "入方向" : "出方向";
        const protocol = r.IpProtocol ?? "ALL";
        const port = r.PortRange ?? "-1/-1";
        const source = r.SourceCidrIp || r.SourceGroupId || "全部";
        const dest = r.DestCidrIp || r.DestGroupId || "全部";
        const policy = r.Policy === "Accept" ? "允许" : "拒绝";
        const target = r.Direction === "ingress" ? `源: ${source}` : `目标: ${dest}`;
        lines.push(
          `${i + 1}. [${direction}] ${protocol} ${port} | ${target} | ${policy} | 优先级: ${r.Priority ?? 1}`,
        );
      });

      return lines.join("\n");
    } catch (err: any) {
      return `获取安全组规则失败: ${err.message ?? err}`;
    }
  });

  return handlers;
}

/** 安全组 Tool 模块 */
export const securityTools: ToolModule = { definitions, createHandlers };
