/**
 * ECS 云服务器 Tools
 * 提供 ECS 实例的列出、查看、启动、停止、重启能力
 */
import type { AliyunClient } from "../aliyun/client.js";
import type { ToolDefinition, ToolHandler } from "../hub/types.js";
import type { ToolModule } from "./index.js";

/** ECS 模块 tool 定义列表 */
const definitions: ToolDefinition[] = [
  {
    name: "list_instances",
    description: "列出 ECS 云服务器实例",
    command: "list_instances",
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
    name: "get_instance",
    description: "获取 ECS 实例详情",
    command: "get_instance",
    parameters: {
      type: "object",
      properties: {
        instance_id: { type: "string", description: "实例 ID" },
      },
      required: ["instance_id"],
    },
  },
  {
    name: "start_instance",
    description: "启动 ECS 实例",
    command: "start_instance",
    parameters: {
      type: "object",
      properties: {
        instance_id: { type: "string", description: "实例 ID" },
      },
      required: ["instance_id"],
    },
  },
  {
    name: "stop_instance",
    description: "停止 ECS 实例",
    command: "stop_instance",
    parameters: {
      type: "object",
      properties: {
        instance_id: { type: "string", description: "实例 ID" },
      },
      required: ["instance_id"],
    },
  },
  {
    name: "reboot_instance",
    description: "重启 ECS 实例",
    command: "reboot_instance",
    parameters: {
      type: "object",
      properties: {
        instance_id: { type: "string", description: "实例 ID" },
      },
      required: ["instance_id"],
    },
  },
];

/** 创建 ECS 模块的 handler 映射 */
function createHandlers(client: AliyunClient): Map<string, ToolHandler> {
  const handlers = new Map<string, ToolHandler>();

  // 列出 ECS 实例
  handlers.set("list_instances", async (ctx) => {
    const region = (ctx.args.region as string) || undefined;
    const params: Record<string, string> = {
      PageSize: "50",
    };
    if (region) {
      params.RegionId = region;
    }

    try {
      const res = await client.request("ecs.aliyuncs.com", "DescribeInstances", params);
      const instances = res.Instances?.Instance ?? [];

      if (instances.length === 0) {
        return "当前区域暂无 ECS 实例";
      }

      const lines = instances.map((inst: any, i: number) => {
        const status = inst.Status ?? "未知";
        const ip =
          inst.PublicIpAddress?.IpAddress?.[0] ??
          inst.EipAddress?.IpAddress ??
          inst.VpcAttributes?.PrivateIpAddress?.IpAddress?.[0] ??
          "无公网IP";
        const spec = inst.InstanceType ?? "";
        return `${i + 1}. ${inst.InstanceName || inst.InstanceId} [${status}]\n   ID: ${inst.InstanceId} | 规格: ${spec} | IP: ${ip}`;
      });

      return `ECS 实例列表（共 ${instances.length} 台）:\n${lines.join("\n")}`;
    } catch (err: any) {
      return `列出 ECS 实例失败: ${err.message ?? err}`;
    }
  });

  // 获取 ECS 实例详情
  handlers.set("get_instance", async (ctx) => {
    const instanceId: string = ctx.args.instance_id ?? "";

    try {
      const res = await client.request("ecs.aliyuncs.com", "DescribeInstances", {
        InstanceIds: JSON.stringify([instanceId]),
      });
      const instances = res.Instances?.Instance ?? [];
      if (instances.length === 0) {
        return `未找到实例: ${instanceId}`;
      }

      const inst = instances[0];
      const publicIp =
        inst.PublicIpAddress?.IpAddress?.[0] ??
        inst.EipAddress?.IpAddress ??
        "无";
      const privateIp =
        inst.VpcAttributes?.PrivateIpAddress?.IpAddress?.[0] ?? "无";

      const lines = [
        `实例名称: ${inst.InstanceName || "未命名"}`,
        `实例 ID: ${inst.InstanceId}`,
        `状态: ${inst.Status}`,
        `规格: ${inst.InstanceType}`,
        `CPU: ${inst.Cpu} 核 | 内存: ${inst.Memory} MB`,
        `操作系统: ${inst.OSName || inst.OSType || "未知"}`,
        `公网 IP: ${publicIp}`,
        `内网 IP: ${privateIp}`,
        `可用区: ${inst.ZoneId}`,
        `计费方式: ${inst.InstanceChargeType === "PostPaid" ? "按量付费" : "包年包月"}`,
        `创建时间: ${inst.CreationTime}`,
        `到期时间: ${inst.ExpiredTime || "无"}`,
      ];

      return lines.join("\n");
    } catch (err: any) {
      return `获取实例详情失败: ${err.message ?? err}`;
    }
  });

  // 启动 ECS 实例
  handlers.set("start_instance", async (ctx) => {
    const instanceId: string = ctx.args.instance_id ?? "";

    try {
      await client.request("ecs.aliyuncs.com", "StartInstance", {
        InstanceId: instanceId,
      });
      return `实例 ${instanceId} 启动指令已发送，请稍后查看状态`;
    } catch (err: any) {
      return `启动实例失败: ${err.message ?? err}`;
    }
  });

  // 停止 ECS 实例
  handlers.set("stop_instance", async (ctx) => {
    const instanceId: string = ctx.args.instance_id ?? "";

    try {
      await client.request("ecs.aliyuncs.com", "StopInstance", {
        InstanceId: instanceId,
      });
      return `实例 ${instanceId} 停止指令已发送，请稍后查看状态`;
    } catch (err: any) {
      return `停止实例失败: ${err.message ?? err}`;
    }
  });

  // 重启 ECS 实例
  handlers.set("reboot_instance", async (ctx) => {
    const instanceId: string = ctx.args.instance_id ?? "";

    try {
      await client.request("ecs.aliyuncs.com", "RebootInstance", {
        InstanceId: instanceId,
      });
      return `实例 ${instanceId} 重启指令已发送，请稍后查看状态`;
    } catch (err: any) {
      return `重启实例失败: ${err.message ?? err}`;
    }
  });

  return handlers;
}

/** ECS Tool 模块 */
export const ecsTools: ToolModule = { definitions, createHandlers };
