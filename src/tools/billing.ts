/**
 * 账单费用 Tools
 * 提供余额查询、账单列表、月度费用查看能力
 */
import type { AliyunClient } from "../aliyun/client.js";
import type { ToolDefinition, ToolHandler } from "../hub/types.js";
import type { ToolModule } from "./index.js";

/** 账单模块 tool 定义列表 */
const definitions: ToolDefinition[] = [
  {
    name: "get_balance",
    description: "查询阿里云账户余额",
    command: "get_balance",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "list_bills",
    description: "查看账单列表",
    command: "list_bills",
    parameters: {
      type: "object",
      properties: {
        month: {
          type: "string",
          description: '账单月份，格式 "YYYY-MM"，如 "2026-03"',
        },
      },
      required: ["month"],
    },
  },
  {
    name: "get_monthly_cost",
    description: "查看月度费用汇总",
    command: "get_monthly_cost",
    parameters: {
      type: "object",
      properties: {
        month: {
          type: "string",
          description: '账单月份，格式 "YYYY-MM"，如 "2026-03"',
        },
      },
      required: ["month"],
    },
  },
];

/** 创建账单模块的 handler 映射 */
function createHandlers(client: AliyunClient): Map<string, ToolHandler> {
  const handlers = new Map<string, ToolHandler>();

  // 查询余额
  handlers.set("get_balance", async () => {
    try {
      const res = await client.request("business.aliyuncs.com", "QueryAccountBalance");
      const data = res.Data ?? res;

      const available = data.AvailableAmount ?? data.AvailableCashAmount ?? "未知";
      const credit = data.CreditAmount ?? "0";
      const currency = data.Currency ?? "CNY";

      const lines = [
        `阿里云账户余额:`,
        `可用余额: ${available} ${currency}`,
        `信用额度: ${credit} ${currency}`,
      ];

      if (data.MybankCreditAmount) {
        lines.push(`网商银行信用: ${data.MybankCreditAmount} ${currency}`);
      }

      return lines.join("\n");
    } catch (err: any) {
      return `查询余额失败: ${err.message ?? err}`;
    }
  });

  // 查看账单列表
  handlers.set("list_bills", async (ctx) => {
    const month: string = ctx.args.month ?? "";

    try {
      const res = await client.request("business.aliyuncs.com", "QueryBill", {
        BillingCycle: month,
        PageSize: "50",
        PageNum: "1",
      });
      const items = res.Data?.Items?.Item ?? [];

      if (items.length === 0) {
        return `${month} 暂无账单记录`;
      }

      const lines = items.map((item: any, i: number) => {
        const product = item.ProductName ?? item.ProductCode ?? "未知产品";
        const amount = item.PretaxAmount ?? item.OutstandingAmount ?? "0";
        const status = item.PaymentStatus ?? item.Status ?? "未知";
        return `${i + 1}. ${product} | 金额: ${amount} 元 | 状态: ${status}`;
      });

      return `${month} 账单列表（共 ${items.length} 条）:\n${lines.join("\n")}`;
    } catch (err: any) {
      return `查看账单失败: ${err.message ?? err}`;
    }
  });

  // 查看月度费用汇总
  handlers.set("get_monthly_cost", async (ctx) => {
    const month: string = ctx.args.month ?? "";

    try {
      const res = await client.request("business.aliyuncs.com", "QueryBillOverview", {
        BillingCycle: month,
      });
      const items = res.Data?.Items?.Item ?? [];

      if (items.length === 0) {
        return `${month} 暂无费用记录`;
      }

      let totalCost = 0;
      const lines = items.map((item: any, i: number) => {
        const product = item.ProductName ?? item.ProductCode ?? "未知产品";
        const amount = parseFloat(item.PretaxAmount ?? item.TotalOutstandingAmount ?? "0");
        totalCost += amount;
        return `${i + 1}. ${product}: ${amount.toFixed(2)} 元`;
      });

      lines.unshift(`${month} 月度费用汇总（合计: ${totalCost.toFixed(2)} 元）:`);

      return lines.join("\n");
    } catch (err: any) {
      return `查看月度费用失败: ${err.message ?? err}`;
    }
  });

  return handlers;
}

/** 账单 Tool 模块 */
export const billingTools: ToolModule = { definitions, createHandlers };
