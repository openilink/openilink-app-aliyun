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
  {
    name: "list_images",
    description: "列出 ECS 镜像",
    command: "list_images",
    parameters: {
      type: "object",
      properties: {
        region: {
          type: "string",
          description: "区域 ID，如 cn-hangzhou，不填则使用默认区域",
        },
        image_owner: {
          type: "string",
          description: "镜像来源: self(自定义) / system(系统) / marketplace(市场)，默认 self",
        },
      },
    },
  },
  {
    name: "list_disks",
    description: "列出 ECS 云盘",
    command: "list_disks",
    parameters: {
      type: "object",
      properties: {
        region: {
          type: "string",
          description: "区域 ID，如 cn-hangzhou，不填则使用默认区域",
        },
        instance_id: {
          type: "string",
          description: "实例 ID，不填则列出所有云盘",
        },
      },
    },
  },
  {
    name: "list_snapshots",
    description: "列出 ECS 快照",
    command: "list_snapshots",
    parameters: {
      type: "object",
      properties: {
        region: {
          type: "string",
          description: "区域 ID，如 cn-hangzhou，不填则使用默认区域",
        },
        disk_id: {
          type: "string",
          description: "云盘 ID，不填则列出所有快照",
        },
      },
    },
  },
  {
    name: "create_instance",
    description: "创建 ECS 实例（简化版，仅支持基本参数，复杂配置建议使用控制台）",
    command: "create_instance",
    parameters: {
      type: "object",
      properties: {
        region: { type: "string", description: "区域 ID，如 cn-hangzhou" },
        image_id: { type: "string", description: "镜像 ID" },
        instance_type: { type: "string", description: "实例规格，如 ecs.t6-c1m1.large" },
        security_group_id: { type: "string", description: "安全组 ID" },
        vswitch_id: { type: "string", description: "交换机 ID（VPC 网络必填）" },
        instance_name: { type: "string", description: "实例名称，可选" },
      },
      required: ["region", "image_id", "instance_type", "security_group_id", "vswitch_id"],
    },
  },
  {
    name: "delete_instance",
    description: "释放 ECS 实例（仅支持按量付费或已过期的包年包月实例）",
    command: "delete_instance",
    parameters: {
      type: "object",
      properties: {
        instance_id: { type: "string", description: "实例 ID" },
        force: { type: "string", description: "是否强制释放: true / false，默认 false" },
      },
      required: ["instance_id"],
    },
  },
  {
    name: "modify_instance",
    description: "修改 ECS 实例名称",
    command: "modify_instance",
    parameters: {
      type: "object",
      properties: {
        instance_id: { type: "string", description: "实例 ID" },
        instance_name: { type: "string", description: "新的实例名称" },
      },
      required: ["instance_id", "instance_name"],
    },
  },
  {
    name: "create_snapshot",
    description: "为云盘创建快照",
    command: "create_snapshot",
    parameters: {
      type: "object",
      properties: {
        disk_id: { type: "string", description: "云盘 ID" },
        snapshot_name: { type: "string", description: "快照名称，可选" },
      },
      required: ["disk_id"],
    },
  },
  {
    name: "delete_snapshot",
    description: "删除快照",
    command: "delete_snapshot",
    parameters: {
      type: "object",
      properties: {
        snapshot_id: { type: "string", description: "快照 ID" },
      },
      required: ["snapshot_id"],
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

  // 列出镜像
  handlers.set("list_images", async (ctx) => {
    const region = (ctx.args.region as string) || undefined;
    const imageOwner = (ctx.args.image_owner as string) || "self";
    const params: Record<string, string> = {
      PageSize: "50",
      ImageOwnerAlias: imageOwner,
    };
    if (region) {
      params.RegionId = region;
    }

    try {
      const res = await client.request("ecs.aliyuncs.com", "DescribeImages", params);
      const images = res.Images?.Image ?? [];

      if (images.length === 0) {
        return "当前区域暂无镜像";
      }

      const lines = images.map((img: any, i: number) => {
        const size = img.Size ?? "未知";
        const status = img.Status ?? "未知";
        return `${i + 1}. ${img.ImageName || img.ImageId} [${status}]\n   ID: ${img.ImageId} | 大小: ${size}GB | 系统: ${img.OSName ?? img.OSType ?? "未知"} | 创建: ${img.CreationTime ?? "未知"}`;
      });

      return `镜像列表（共 ${images.length} 个）:\n${lines.join("\n")}`;
    } catch (err: any) {
      return `列出镜像失败: ${err.message ?? err}`;
    }
  });

  // 列出云盘
  handlers.set("list_disks", async (ctx) => {
    const region = (ctx.args.region as string) || undefined;
    const instanceId = (ctx.args.instance_id as string) || undefined;
    const params: Record<string, string> = {
      PageSize: "50",
    };
    if (region) {
      params.RegionId = region;
    }
    if (instanceId) {
      params.InstanceId = instanceId;
    }

    try {
      const res = await client.request("ecs.aliyuncs.com", "DescribeDisks", params);
      const disks = res.Disks?.Disk ?? [];

      if (disks.length === 0) {
        return "当前区域暂无云盘";
      }

      const lines = disks.map((d: any, i: number) => {
        const status = d.Status ?? "未知";
        const size = d.Size ?? "未知";
        const category = d.Category ?? "未知";
        const attachedTo = d.InstanceId || "未挂载";
        return `${i + 1}. ${d.DiskName || d.DiskId} [${status}]\n   ID: ${d.DiskId} | 大小: ${size}GB | 类型: ${category} | 挂载: ${attachedTo}`;
      });

      return `云盘列表（共 ${disks.length} 个）:\n${lines.join("\n")}`;
    } catch (err: any) {
      return `列出云盘失败: ${err.message ?? err}`;
    }
  });

  // 列出快照
  handlers.set("list_snapshots", async (ctx) => {
    const region = (ctx.args.region as string) || undefined;
    const diskId = (ctx.args.disk_id as string) || undefined;
    const params: Record<string, string> = {
      PageSize: "50",
    };
    if (region) {
      params.RegionId = region;
    }
    if (diskId) {
      params.DiskId = diskId;
    }

    try {
      const res = await client.request("ecs.aliyuncs.com", "DescribeSnapshots", params);
      const snapshots = res.Snapshots?.Snapshot ?? [];

      if (snapshots.length === 0) {
        return "当前区域暂无快照";
      }

      const lines = snapshots.map((s: any, i: number) => {
        const status = s.Status ?? "未知";
        const size = s.SourceDiskSize ?? "未知";
        return `${i + 1}. ${s.SnapshotName || s.SnapshotId} [${status}]\n   ID: ${s.SnapshotId} | 源盘大小: ${size}GB | 创建: ${s.CreationTime ?? "未知"} | 进度: ${s.Progress ?? "未知"}`;
      });

      return `快照列表（共 ${snapshots.length} 个）:\n${lines.join("\n")}`;
    } catch (err: any) {
      return `列出快照失败: ${err.message ?? err}`;
    }
  });

  // 创建 ECS 实例（简化版）
  handlers.set("create_instance", async (ctx) => {
    const region: string = ctx.args.region ?? "";
    const imageId: string = ctx.args.image_id ?? "";
    const instanceType: string = ctx.args.instance_type ?? "";
    const securityGroupId: string = ctx.args.security_group_id ?? "";
    const vswitchId: string = ctx.args.vswitch_id ?? "";
    const instanceName: string = ctx.args.instance_name ?? "";

    const params: Record<string, string> = {
      RegionId: region,
      ImageId: imageId,
      InstanceType: instanceType,
      SecurityGroupId: securityGroupId,
      VSwitchId: vswitchId,
      InternetChargeType: "PayByTraffic",
      InternetMaxBandwidthOut: "1",
      InstanceChargeType: "PostPaid",
    };
    if (instanceName) {
      params.InstanceName = instanceName;
    }

    try {
      const res = await client.request("ecs.aliyuncs.com", "CreateInstance", params);
      return `ECS 实例创建成功!\n实例 ID: ${res.InstanceId}\n提示: 实例创建后处于 Stopped 状态，请使用 start_instance 启动。\n如需更复杂的配置（如数据盘、密钥对等），建议使用阿里云控制台。`;
    } catch (err: any) {
      return `创建 ECS 实例失败: ${err.message ?? err}`;
    }
  });

  // 释放 ECS 实例
  handlers.set("delete_instance", async (ctx) => {
    const instanceId: string = ctx.args.instance_id ?? "";
    const force: string = ctx.args.force ?? "false";

    const params: Record<string, string> = {
      InstanceId: instanceId,
    };
    if (force === "true") {
      params.Force = "true";
    }

    try {
      await client.request("ecs.aliyuncs.com", "DeleteInstance", params);
      return `实例 ${instanceId} 已释放`;
    } catch (err: any) {
      return `释放实例失败: ${err.message ?? err}`;
    }
  });

  // 修改 ECS 实例名称
  handlers.set("modify_instance", async (ctx) => {
    const instanceId: string = ctx.args.instance_id ?? "";
    const instanceName: string = ctx.args.instance_name ?? "";

    try {
      await client.request("ecs.aliyuncs.com", "ModifyInstanceAttribute", {
        InstanceId: instanceId,
        InstanceName: instanceName,
      });
      return `实例 ${instanceId} 名称已修改为: ${instanceName}`;
    } catch (err: any) {
      return `修改实例名称失败: ${err.message ?? err}`;
    }
  });

  // 创建快照
  handlers.set("create_snapshot", async (ctx) => {
    const diskId: string = ctx.args.disk_id ?? "";
    const snapshotName: string = ctx.args.snapshot_name ?? "";

    const params: Record<string, string> = {
      DiskId: diskId,
    };
    if (snapshotName) {
      params.SnapshotName = snapshotName;
    }

    try {
      const res = await client.request("ecs.aliyuncs.com", "CreateSnapshot", params);
      return `快照创建任务已提交!\n快照 ID: ${res.SnapshotId}\n云盘 ID: ${diskId}\n提示: 快照创建需要一定时间，请稍后查看进度。`;
    } catch (err: any) {
      return `创建快照失败: ${err.message ?? err}`;
    }
  });

  // 删除快照
  handlers.set("delete_snapshot", async (ctx) => {
    const snapshotId: string = ctx.args.snapshot_id ?? "";

    try {
      await client.request("ecs.aliyuncs.com", "DeleteSnapshot", {
        SnapshotId: snapshotId,
      });
      return `快照 ${snapshotId} 已删除`;
    } catch (err: any) {
      return `删除快照失败: ${err.message ?? err}`;
    }
  });

  return handlers;
}

/** ECS Tool 模块 */
export const ecsTools: ToolModule = { definitions, createHandlers };
