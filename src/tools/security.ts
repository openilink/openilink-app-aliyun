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
  {
    name: "create_security_group",
    description: "创建安全组",
    command: "create_security_group",
    parameters: {
      type: "object",
      properties: {
        group_name: { type: "string", description: "安全组名称" },
        vpc_id: { type: "string", description: "VPC ID（VPC 网络必填）" },
        description: { type: "string", description: "安全组描述，可选" },
      },
      required: ["group_name", "vpc_id"],
    },
  },
  {
    name: "add_security_rule",
    description: "添加安全组入方向规则",
    command: "add_security_rule",
    parameters: {
      type: "object",
      properties: {
        group_id: { type: "string", description: "安全组 ID" },
        ip_protocol: { type: "string", description: "协议: tcp / udp / icmp / gre / all" },
        port_range: { type: "string", description: "端口范围，如 80/80、22/22、-1/-1(全部)" },
        source_cidr: { type: "string", description: "授权源 CIDR，如 0.0.0.0/0" },
        policy: { type: "string", description: "策略: accept(允许) / drop(拒绝)，默认 accept" },
        priority: { type: "string", description: "优先级 1-100，默认 1" },
      },
      required: ["group_id", "ip_protocol", "port_range", "source_cidr"],
    },
  },
  {
    name: "remove_security_rule",
    description: "删除安全组入方向规则",
    command: "remove_security_rule",
    parameters: {
      type: "object",
      properties: {
        group_id: { type: "string", description: "安全组 ID" },
        ip_protocol: { type: "string", description: "协议: tcp / udp / icmp / gre / all" },
        port_range: { type: "string", description: "端口范围，如 80/80、22/22、-1/-1(全部)" },
        source_cidr: { type: "string", description: "授权源 CIDR，如 0.0.0.0/0" },
        policy: { type: "string", description: "策略: accept(允许) / drop(拒绝)，默认 accept" },
        priority: { type: "string", description: "优先级 1-100，默认 1" },
      },
      required: ["group_id", "ip_protocol", "port_range", "source_cidr"],
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

  // 创建安全组
  handlers.set("create_security_group", async (ctx) => {
    const groupName: string = ctx.args.group_name ?? "";
    const vpcId: string = ctx.args.vpc_id ?? "";
    const description: string = ctx.args.description ?? "";

    const params: Record<string, string> = {
      SecurityGroupName: groupName,
      VpcId: vpcId,
    };
    if (description) {
      params.Description = description;
    }

    try {
      const res = await client.request("ecs.aliyuncs.com", "CreateSecurityGroup", params);
      return `安全组创建成功!\n名称: ${groupName}\n安全组 ID: ${res.SecurityGroupId}\nVPC: ${vpcId}`;
    } catch (err: any) {
      return `创建安全组失败: ${err.message ?? err}`;
    }
  });

  // 添加安全组入方向规则
  handlers.set("add_security_rule", async (ctx) => {
    const groupId: string = ctx.args.group_id ?? "";
    const ipProtocol: string = ctx.args.ip_protocol ?? "";
    const portRange: string = ctx.args.port_range ?? "";
    const sourceCidr: string = ctx.args.source_cidr ?? "";
    const policy: string = ctx.args.policy ?? "accept";
    const priority: string = ctx.args.priority ?? "1";

    try {
      await client.request("ecs.aliyuncs.com", "AuthorizeSecurityGroup", {
        SecurityGroupId: groupId,
        IpProtocol: ipProtocol,
        PortRange: portRange,
        SourceCidrIp: sourceCidr,
        Policy: policy,
        Priority: priority,
      });
      return `安全组规则添加成功!\n安全组: ${groupId}\n协议: ${ipProtocol} | 端口: ${portRange} | 源: ${sourceCidr} | 策略: ${policy}`;
    } catch (err: any) {
      return `添加安全组规则失败: ${err.message ?? err}`;
    }
  });

  // 删除安全组入方向规则
  handlers.set("remove_security_rule", async (ctx) => {
    const groupId: string = ctx.args.group_id ?? "";
    const ipProtocol: string = ctx.args.ip_protocol ?? "";
    const portRange: string = ctx.args.port_range ?? "";
    const sourceCidr: string = ctx.args.source_cidr ?? "";
    const policy: string = ctx.args.policy ?? "accept";
    const priority: string = ctx.args.priority ?? "1";

    try {
      await client.request("ecs.aliyuncs.com", "RevokeSecurityGroup", {
        SecurityGroupId: groupId,
        IpProtocol: ipProtocol,
        PortRange: portRange,
        SourceCidrIp: sourceCidr,
        Policy: policy,
        Priority: priority,
      });
      return `安全组规则已删除!\n安全组: ${groupId}\n协议: ${ipProtocol} | 端口: ${portRange} | 源: ${sourceCidr}`;
    } catch (err: any) {
      return `删除安全组规则失败: ${err.message ?? err}`;
    }
  });

  return handlers;
}

/** 安全组 Tool 模块 */
export const securityTools: ToolModule = { definitions, createHandlers };
