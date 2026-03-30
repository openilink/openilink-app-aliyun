/**
 * Redis 云数据库 Tools
 * 提供 Redis 实例列出、详情查看能力
 */
import type { AliyunClient } from "../aliyun/client.js";
import type { ToolDefinition, ToolHandler } from "../hub/types.js";
import type { ToolModule } from "./index.js";

/** Redis 模块 tool 定义列表 */
const definitions: ToolDefinition[] = [
  {
    name: "list_redis_instances",
    description: "列出 Redis 云数据库实例",
    command: "list_redis_instances",
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
    name: "get_redis_instance",
    description: "获取 Redis 实例详情",
    command: "get_redis_instance",
    parameters: {
      type: "object",
      properties: {
        instance_id: { type: "string", description: "Redis 实例 ID" },
      },
      required: ["instance_id"],
    },
  },
];

/** 创建 Redis 模块的 handler 映射 */
function createHandlers(client: AliyunClient): Map<string, ToolHandler> {
  const handlers = new Map<string, ToolHandler>();

  // 列出 Redis 实例
  handlers.set("list_redis_instances", async (ctx) => {
    const region = (ctx.args.region as string) || undefined;
    const params: Record<string, string> = {
      PageSize: "50",
    };
    if (region) {
      params.RegionId = region;
    }

    try {
      const res = await client.request("r-kvstore.aliyuncs.com", "DescribeInstances", params);
      const instances = res.Instances?.KVStoreInstance ?? [];

      if (instances.length === 0) {
        return "当前区域暂无 Redis 实例";
      }

      const lines = instances.map((inst: any, i: number) => {
        const status = inst.InstanceStatus ?? "未知";
        const spec = inst.InstanceClass ?? "未知";
        const bandwidth = inst.Bandwidth ?? "未知";
        return `${i + 1}. ${inst.InstanceName || inst.InstanceId} [${status}]\n   ID: ${inst.InstanceId} | 规格: ${spec} | 带宽: ${bandwidth}Mbps | 引擎: ${inst.EngineVersion ?? "未知"}`;
      });

      return `Redis 实例列表（共 ${instances.length} 个）:\n${lines.join("\n")}`;
    } catch (err: any) {
      return `列出 Redis 实例失败: ${err.message ?? err}`;
    }
  });

  // 获取 Redis 实例详情
  handlers.set("get_redis_instance", async (ctx) => {
    const instanceId: string = ctx.args.instance_id ?? "";

    try {
      const res = await client.request("r-kvstore.aliyuncs.com", "DescribeInstanceAttribute", {
        InstanceId: instanceId,
      });
      const items = res.Instances?.DBInstanceAttribute ?? [];
      if (items.length === 0) {
        return `未找到 Redis 实例: ${instanceId}`;
      }

      const inst = items[0];
      const lines = [
        `实例名称: ${inst.InstanceName || "未命名"}`,
        `实例 ID: ${inst.InstanceId}`,
        `状态: ${inst.InstanceStatus}`,
        `引擎版本: ${inst.EngineVersion ?? "未知"}`,
        `架构: ${inst.ArchitectureType ?? "未知"}`,
        `规格: ${inst.InstanceClass}`,
        `容量: ${inst.Capacity ?? "未知"} MB`,
        `带宽: ${inst.Bandwidth ?? "未知"} Mbps`,
        `连接地址: ${inst.ConnectionDomain ?? "无"}`,
        `端口: ${inst.Port ?? "无"}`,
        `可用区: ${inst.ZoneId ?? "未知"}`,
        `VPC ID: ${inst.VpcId ?? "无"}`,
        `计费方式: ${inst.ChargeType === "PostPaid" ? "按量付费" : "包年包月"}`,
        `创建时间: ${inst.CreateTime ?? "未知"}`,
        `到期时间: ${inst.EndTime || "无"}`,
      ];

      return lines.join("\n");
    } catch (err: any) {
      return `获取 Redis 实例详情失败: ${err.message ?? err}`;
    }
  });

  return handlers;
}

/** Redis Tool 模块 */
export const redisTools: ToolModule = { definitions, createHandlers };
