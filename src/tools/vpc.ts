/**
 * VPC 专有网络 Tools
 * 提供 VPC、交换机、弹性公网 IP 的列出能力
 */
import type { AliyunClient } from "../aliyun/client.js";
import type { ToolDefinition, ToolHandler } from "../hub/types.js";
import type { ToolModule } from "./index.js";

/** VPC 模块 tool 定义列表 */
const definitions: ToolDefinition[] = [
  {
    name: "list_vpcs",
    description: "列出 VPC 专有网络",
    command: "list_vpcs",
    parameters: {
      type: "object",
      properties: {
        region: {
          type: "string",
          description: "区域 ID，如 cn-hangzhou，不填则使用默认区域",
        },
      },
    },
  },
  {
    name: "list_vswitches",
    description: "列出交换机",
    command: "list_vswitches",
    parameters: {
      type: "object",
      properties: {
        vpc_id: { type: "string", description: "VPC ID，不填则列出所有交换机" },
      },
    },
  },
  {
    name: "list_eips",
    description: "列出弹性公网 IP",
    command: "list_eips",
    parameters: {
      type: "object",
      properties: {
        region: {
          type: "string",
          description: "区域 ID，如 cn-hangzhou，不填则使用默认区域",
        },
      },
    },
  },
  {
    name: "create_vpc",
    description: "创建 VPC 专有网络",
    command: "create_vpc",
    parameters: {
      type: "object",
      properties: {
        region: { type: "string", description: "区域 ID，如 cn-hangzhou" },
        cidr_block: { type: "string", description: "VPC 网段，如 172.16.0.0/12、10.0.0.0/8、192.168.0.0/16" },
        vpc_name: { type: "string", description: "VPC 名称，可选" },
        description: { type: "string", description: "VPC 描述，可选" },
      },
      required: ["region", "cidr_block"],
    },
  },
  {
    name: "delete_vpc",
    description: "删除 VPC 专有网络（需先删除 VPC 下的所有资源）",
    command: "delete_vpc",
    parameters: {
      type: "object",
      properties: {
        vpc_id: { type: "string", description: "VPC ID" },
      },
      required: ["vpc_id"],
    },
  },
];

/** 创建 VPC 模块的 handler 映射 */
function createHandlers(client: AliyunClient): Map<string, ToolHandler> {
  const handlers = new Map<string, ToolHandler>();

  // 列出 VPC
  handlers.set("list_vpcs", async (ctx) => {
    const region = (ctx.args.region as string) || undefined;
    const params: Record<string, string> = {
      PageSize: "50",
    };
    if (region) {
      params.RegionId = region;
    }

    try {
      const res = await client.request("vpc.aliyuncs.com", "DescribeVpcs", params);
      const vpcs = res.Vpcs?.Vpc ?? [];

      if (vpcs.length === 0) {
        return "当前区域暂无 VPC";
      }

      const lines = vpcs.map((v: any, i: number) => {
        const cidr = v.CidrBlock ?? "无";
        const status = v.Status ?? "未知";
        const vswitchCount = v.VSwitchIds?.VSwitchId?.length ?? 0;
        return `${i + 1}. ${v.VpcName || v.VpcId} [${status}]\n   ID: ${v.VpcId} | 网段: ${cidr} | 交换机数: ${vswitchCount}`;
      });

      return `VPC 列表（共 ${vpcs.length} 个）:\n${lines.join("\n")}`;
    } catch (err: any) {
      return `列出 VPC 失败: ${err.message ?? err}`;
    }
  });

  // 列出交换机
  handlers.set("list_vswitches", async (ctx) => {
    const vpcId = (ctx.args.vpc_id as string) || undefined;
    const params: Record<string, string> = {
      PageSize: "50",
    };
    if (vpcId) {
      params.VpcId = vpcId;
    }

    try {
      const res = await client.request("vpc.aliyuncs.com", "DescribeVSwitches", params);
      const vswitches = res.VSwitches?.VSwitch ?? [];

      if (vswitches.length === 0) {
        return "当前区域暂无交换机";
      }

      const lines = vswitches.map((v: any, i: number) => {
        const cidr = v.CidrBlock ?? "无";
        const status = v.Status ?? "未知";
        const available = v.AvailableIpAddressCount ?? "未知";
        return `${i + 1}. ${v.VSwitchName || v.VSwitchId} [${status}]\n   ID: ${v.VSwitchId} | 网段: ${cidr} | 可用IP数: ${available} | 可用区: ${v.ZoneId ?? "未知"}`;
      });

      return `交换机列表（共 ${vswitches.length} 个）:\n${lines.join("\n")}`;
    } catch (err: any) {
      return `列出交换机失败: ${err.message ?? err}`;
    }
  });

  // 列出弹性公网 IP
  handlers.set("list_eips", async (ctx) => {
    const region = (ctx.args.region as string) || undefined;
    const params: Record<string, string> = {
      PageSize: "50",
    };
    if (region) {
      params.RegionId = region;
    }

    try {
      const res = await client.request("vpc.aliyuncs.com", "DescribeEipAddresses", params);
      const eips = res.EipAddresses?.EipAddress ?? [];

      if (eips.length === 0) {
        return "当前区域暂无弹性公网 IP";
      }

      const lines = eips.map((e: any, i: number) => {
        const status = e.Status ?? "未知";
        const bindType = e.InstanceType ?? "未绑定";
        const bindId = e.InstanceId || "无";
        const bandwidth = e.Bandwidth ?? "未知";
        return `${i + 1}. ${e.IpAddress} [${status}]\n   ID: ${e.AllocationId} | 带宽: ${bandwidth}Mbps | 绑定: ${bindType}/${bindId}`;
      });

      return `弹性公网 IP 列表（共 ${eips.length} 个）:\n${lines.join("\n")}`;
    } catch (err: any) {
      return `列出弹性公网 IP 失败: ${err.message ?? err}`;
    }
  });

  // 创建 VPC
  handlers.set("create_vpc", async (ctx) => {
    const region: string = ctx.args.region ?? "";
    const cidrBlock: string = ctx.args.cidr_block ?? "";
    const vpcName: string = ctx.args.vpc_name ?? "";
    const description: string = ctx.args.description ?? "";

    const params: Record<string, string> = {
      RegionId: region,
      CidrBlock: cidrBlock,
    };
    if (vpcName) {
      params.VpcName = vpcName;
    }
    if (description) {
      params.Description = description;
    }

    try {
      const res = await client.request("vpc.aliyuncs.com", "CreateVpc", params);
      return `VPC 创建成功!\nVPC ID: ${res.VpcId}\n区域: ${region}\n网段: ${cidrBlock}`;
    } catch (err: any) {
      return `创建 VPC 失败: ${err.message ?? err}`;
    }
  });

  // 删除 VPC
  handlers.set("delete_vpc", async (ctx) => {
    const vpcId: string = ctx.args.vpc_id ?? "";

    try {
      await client.request("vpc.aliyuncs.com", "DeleteVpc", {
        VpcId: vpcId,
      });
      return `VPC ${vpcId} 已删除`;
    } catch (err: any) {
      return `删除 VPC 失败: ${err.message ?? err}`;
    }
  });

  return handlers;
}

/** VPC Tool 模块 */
export const vpcTools: ToolModule = { definitions, createHandlers };
