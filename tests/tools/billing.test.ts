/**
 * tools/billing.ts 测试
 * Mock AliyunClient 验证账单工具的 handler 和定义
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { billingTools } from "../../src/tools/billing.js";
import type { ToolContext } from "../../src/hub/types.js";

function createMockClient() {
  return {
    getRegion: vi.fn().mockReturnValue("cn-hangzhou"),
    request: vi.fn(),
  } as any;
}

function makeCtx(args: Record<string, any>): ToolContext {
  return {
    installationId: "inst-001",
    botId: "bot-001",
    userId: "user-001",
    traceId: "trace-001",
    args,
  };
}

describe("billingTools", () => {
  describe("tool definitions", () => {
    it("应包含 3 个账单相关工具定义", () => {
      expect(billingTools.definitions).toHaveLength(3);
      const names = billingTools.definitions.map((d) => d.name);
      expect(names).toContain("get_balance");
      expect(names).toContain("list_bills");
      expect(names).toContain("get_monthly_cost");
    });

    it("list_bills 应要求 month 为必填", () => {
      const def = billingTools.definitions.find((d) => d.name === "list_bills");
      expect(def?.parameters?.required).toContain("month");
    });
  });

  describe("createHandlers", () => {
    let client: ReturnType<typeof createMockClient>;
    let handlers: Map<string, any>;

    beforeEach(() => {
      client = createMockClient();
      handlers = billingTools.createHandlers(client);
    });

    describe("get_balance", () => {
      it("应返回余额信息", async () => {
        client.request.mockResolvedValue({
          Data: {
            AvailableAmount: "1234.56",
            CreditAmount: "0",
            Currency: "CNY",
          },
        });

        const handler = handlers.get("get_balance")!;
        const result = await handler(makeCtx({}));
        expect(result).toContain("余额");
        expect(result).toContain("1234.56");
        expect(result).toContain("CNY");
      });

      it("API 出错时应返回错误消息", async () => {
        client.request.mockRejectedValue(new Error("权限不足"));

        const handler = handlers.get("get_balance")!;
        const result = await handler(makeCtx({}));
        expect(result).toContain("查询余额失败");
      });
    });

    describe("get_monthly_cost", () => {
      it("应返回月度费用汇总", async () => {
        client.request.mockResolvedValue({
          Data: {
            Items: {
              Item: [
                { ProductName: "云服务器 ECS", PretaxAmount: "500.00" },
                { ProductName: "对象存储 OSS", PretaxAmount: "30.50" },
              ],
            },
          },
        });

        const handler = handlers.get("get_monthly_cost")!;
        const result = await handler(makeCtx({ month: "2026-03" }));
        expect(result).toContain("月度费用汇总");
        expect(result).toContain("云服务器 ECS");
        expect(result).toContain("500.00");
        expect(result).toContain("对象存储 OSS");
        expect(result).toContain("530.50"); // 总计
      });

      it("无费用记录时应返回提示", async () => {
        client.request.mockResolvedValue({ Data: { Items: { Item: [] } } });

        const handler = handlers.get("get_monthly_cost")!;
        const result = await handler(makeCtx({ month: "2026-01" }));
        expect(result).toContain("暂无费用记录");
      });
    });
  });
});
