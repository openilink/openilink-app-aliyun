/**
 * RDS 云数据库 Tools
 * 提供 RDS 实例列出、详情查看、数据库列出能力
 */
import type { AliyunClient } from "../aliyun/client.js";
import type { ToolDefinition, ToolHandler } from "../hub/types.js";
import type { ToolModule } from "./index.js";

/** RDS 模块 tool 定义列表 */
const definitions: ToolDefinition[] = [
  {
    name: "list_rds_instances",
    description: "列出 RDS 云数据库实例",
    command: "list_rds_instances",
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
    name: "get_rds_instance",
    description: "获取 RDS 实例详情",
    command: "get_rds_instance",
    parameters: {
      type: "object",
      properties: {
        instance_id: { type: "string", description: "RDS 实例 ID" },
      },
      required: ["instance_id"],
    },
  },
  {
    name: "list_rds_databases",
    description: "列出 RDS 实例中的数据库",
    command: "list_rds_databases",
    parameters: {
      type: "object",
      properties: {
        instance_id: { type: "string", description: "RDS 实例 ID" },
      },
      required: ["instance_id"],
    },
  },
];

/** 创建 RDS 模块的 handler 映射 */
function createHandlers(client: AliyunClient): Map<string, ToolHandler> {
  const handlers = new Map<string, ToolHandler>();

  // 列出 RDS 实例
  handlers.set("list_rds_instances", async (ctx) => {
    const region = (ctx.args.region as string) || undefined;
    const params: Record<string, string> = {
      PageSize: "50",
    };
    if (region) {
      params.RegionId = region;
    }

    try {
      const res = await client.request("rds.aliyuncs.com", "DescribeDBInstances", params);
      const instances = res.Items?.DBInstance ?? [];

      if (instances.length === 0) {
        return "当前区域暂无 RDS 实例";
      }

      const lines = instances.map((inst: any, i: number) => {
        const status = inst.DBInstanceStatus ?? "未知";
        const engine = `${inst.Engine ?? ""}${inst.EngineVersion ? " " + inst.EngineVersion : ""}`;
        const spec = inst.DBInstanceClass ?? "未知";
        return `${i + 1}. ${inst.DBInstanceDescription || inst.DBInstanceId} [${status}]\n   ID: ${inst.DBInstanceId} | 引擎: ${engine} | 规格: ${spec} | 类型: ${inst.DBInstanceType ?? "未知"}`;
      });

      return `RDS 实例列表（共 ${instances.length} 个）:\n${lines.join("\n")}`;
    } catch (err: any) {
      return `列出 RDS 实例失败: ${err.message ?? err}`;
    }
  });

  // 获取 RDS 实例详情
  handlers.set("get_rds_instance", async (ctx) => {
    const instanceId: string = ctx.args.instance_id ?? "";

    try {
      const res = await client.request("rds.aliyuncs.com", "DescribeDBInstanceAttribute", {
        DBInstanceId: instanceId,
      });
      const items = res.Items?.DBInstanceAttribute ?? [];
      if (items.length === 0) {
        return `未找到 RDS 实例: ${instanceId}`;
      }

      const inst = items[0];
      const lines = [
        `实例名称: ${inst.DBInstanceDescription || "未命名"}`,
        `实例 ID: ${inst.DBInstanceId}`,
        `状态: ${inst.DBInstanceStatus}`,
        `引擎: ${inst.Engine} ${inst.EngineVersion}`,
        `规格: ${inst.DBInstanceClass}`,
        `存储: ${inst.DBInstanceStorage} GB`,
        `类型: ${inst.DBInstanceType}`,
        `连接地址: ${inst.ConnectionString ?? "无"}`,
        `端口: ${inst.Port ?? "无"}`,
        `可用区: ${inst.ZoneId}`,
        `VPC ID: ${inst.VpcId ?? "无"}`,
        `计费方式: ${inst.PayType === "Postpaid" ? "按量付费" : "包年包月"}`,
        `创建时间: ${inst.CreationTime}`,
        `到期时间: ${inst.ExpireTime || "无"}`,
      ];

      return lines.join("\n");
    } catch (err: any) {
      return `获取 RDS 实例详情失败: ${err.message ?? err}`;
    }
  });

  // 列出数据库
  handlers.set("list_rds_databases", async (ctx) => {
    const instanceId: string = ctx.args.instance_id ?? "";

    try {
      const res = await client.request("rds.aliyuncs.com", "DescribeDatabases", {
        DBInstanceId: instanceId,
      });
      const databases = res.Databases?.Database ?? [];

      if (databases.length === 0) {
        return `RDS 实例 ${instanceId} 暂无数据库`;
      }

      const lines = databases.map((db: any, i: number) => {
        const status = db.DBStatus ?? "未知";
        const charset = db.CharacterSetName ?? "未知";
        return `${i + 1}. ${db.DBName} [${status}]\n   字符集: ${charset} | 描述: ${db.DBDescription || "无"}`;
      });

      return `RDS 实例 ${instanceId} 数据库列表（共 ${databases.length} 个）:\n${lines.join("\n")}`;
    } catch (err: any) {
      return `列出数据库失败: ${err.message ?? err}`;
    }
  });

  return handlers;
}

/** RDS Tool 模块 */
export const rdsTools: ToolModule = { definitions, createHandlers };
