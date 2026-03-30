/**
 * SLB 负载均衡 Tools
 * 提供负载均衡实例列出、详情查看、监听列表能力
 */
import type { AliyunClient } from "../aliyun/client.js";
import type { ToolDefinition, ToolHandler } from "../hub/types.js";
import type { ToolModule } from "./index.js";

/** SLB 模块 tool 定义列表 */
const definitions: ToolDefinition[] = [
  {
    name: "list_load_balancers",
    description: "列出负载均衡实例",
    command: "list_load_balancers",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_lb_info",
    description: "获取负载均衡实例详情",
    command: "get_lb_info",
    parameters: {
      type: "object",
      properties: {
        lb_id: { type: "string", description: "负载均衡实例 ID" },
      },
      required: ["lb_id"],
    },
  },
  {
    name: "list_listeners",
    description: "列出负载均衡的监听",
    command: "list_listeners",
    parameters: {
      type: "object",
      properties: {
        lb_id: { type: "string", description: "负载均衡实例 ID" },
      },
      required: ["lb_id"],
    },
  },
];

/** 创建 SLB 模块的 handler 映射 */
function createHandlers(client: AliyunClient): Map<string, ToolHandler> {
  const handlers = new Map<string, ToolHandler>();

  // 列出负载均衡实例
  handlers.set("list_load_balancers", async () => {
    try {
      const res = await client.request("slb.aliyuncs.com", "DescribeLoadBalancers", {
        PageSize: "50",
      });
      const lbs = res.LoadBalancers?.LoadBalancer ?? [];

      if (lbs.length === 0) {
        return "暂无负载均衡实例";
      }

      const lines = lbs.map((lb: any, i: number) => {
        const status = lb.LoadBalancerStatus ?? "未知";
        const addr = lb.Address ?? "无";
        const type = lb.AddressType === "internet" ? "公网" : "内网";
        return `${i + 1}. ${lb.LoadBalancerName || lb.LoadBalancerId} [${status}]\n   ID: ${lb.LoadBalancerId} | ${type}: ${addr} | 规格: ${lb.LoadBalancerSpec ?? "默认"}`;
      });

      return `负载均衡列表（共 ${lbs.length} 个）:\n${lines.join("\n")}`;
    } catch (err: any) {
      return `列出负载均衡失败: ${err.message ?? err}`;
    }
  });

  // 获取负载均衡详情
  handlers.set("get_lb_info", async (ctx) => {
    const lbId: string = ctx.args.lb_id ?? "";

    try {
      const res = await client.request("slb.aliyuncs.com", "DescribeLoadBalancerAttribute", {
        LoadBalancerId: lbId,
      });

      const lines = [
        `名称: ${res.LoadBalancerName || "未命名"}`,
        `ID: ${res.LoadBalancerId}`,
        `状态: ${res.LoadBalancerStatus}`,
        `地址类型: ${res.AddressType === "internet" ? "公网" : "内网"}`,
        `地址: ${res.Address}`,
        `规格: ${res.LoadBalancerSpec ?? "默认"}`,
        `VPC ID: ${res.VpcId ?? "无"}`,
        `计费方式: ${res.PayType === "PayOnDemand" ? "按量付费" : "包年包月"}`,
        `带宽: ${res.Bandwidth ?? "无限制"} Mbps`,
        `创建时间: ${res.CreateTime}`,
      ];

      // 后端服务器列表
      const servers = res.BackendServers?.BackendServer ?? [];
      if (servers.length > 0) {
        lines.push(`\n后端服务器（${servers.length} 台）:`);
        servers.forEach((s: any, i: number) => {
          lines.push(`  ${i + 1}. ${s.ServerId} | 权重: ${s.Weight}`);
        });
      }

      return lines.join("\n");
    } catch (err: any) {
      return `获取负载均衡详情失败: ${err.message ?? err}`;
    }
  });

  // 列出监听（使用 DescribeLoadBalancerListeners 统一接口）
  handlers.set("list_listeners", async (ctx) => {
    const lbId: string = ctx.args.lb_id ?? "";

    try {
      const res = await client.request("slb.aliyuncs.com", "DescribeLoadBalancerListeners", {
        LoadBalancerId: lbId,
        MaxResults: "50",
      });
      const listeners = res.Listeners ?? [];

      if (listeners.length === 0) {
        return `负载均衡 ${lbId} 暂无监听`;
      }

      const lines = listeners.map((l: any, i: number) => {
        const status = l.ListenerStatus ?? "未知";
        return `${i + 1}. ${l.ListenerProtocol ?? "未知"}:${l.ListenerPort} [${status}]\n   后端端口: ${l.BackendServerPort ?? "无"} | 描述: ${l.Description ?? "无"}`;
      });

      return `监听列表（共 ${listeners.length} 个）:\n${lines.join("\n")}`;
    } catch (err: any) {
      return `列出监听失败: ${err.message ?? err}`;
    }
  });

  return handlers;
}

/** SLB Tool 模块 */
export const slbTools: ToolModule = { definitions, createHandlers };
