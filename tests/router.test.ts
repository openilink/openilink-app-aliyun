/**
 * router.ts 测试
 * 验证命令路由分发逻辑
 */
import { describe, it, expect, vi } from "vitest";
import { Router } from "../src/router.js";
import type { HubEvent, Installation, ToolHandler } from "../src/hub/types.js";
import type { HubClient } from "../src/hub/client.js";

/** 创建模拟的 Hub 事件 */
function makeEvent(command: string, args: Record<string, any> = {}): HubEvent {
  return {
    v: 1,
    type: "event",
    trace_id: "trace-001",
    installation_id: "inst-001",
    bot: { id: "bot-001" },
    event: {
      type: "command",
      id: "evt-001",
      timestamp: Date.now(),
      data: { command, args, user_id: "user-001" },
    },
  };
}

const mockInstallation: Installation = {
  id: "inst-001",
  hubUrl: "http://hub.test",
  appId: "aliyun",
  botId: "bot-001",
  appToken: "token",
  webhookSecret: "secret",
  createdAt: new Date().toISOString(),
};

const mockHubClient = {} as HubClient;

describe("Router", () => {
  it("应正确路由到对应的 handler", async () => {
    const handler = vi.fn().mockResolvedValue("执行成功");
    const handlers = new Map<string, ToolHandler>([["list_instances", handler]]);
    const router = new Router(handlers);

    const result = await router.handleCommand(
      makeEvent("list_instances"),
      mockInstallation,
      mockHubClient,
    );

    expect(handler).toHaveBeenCalledOnce();
    expect(result).toBe("执行成功");
  });

  it("未知命令应返回错误提示", async () => {
    const router = new Router(new Map());

    const result = await router.handleCommand(
      makeEvent("unknown_cmd"),
      mockInstallation,
      mockHubClient,
    );

    expect(result).toContain("未知命令");
  });

  it("带 / 前缀的命令应正常匹配", async () => {
    const handler = vi.fn().mockResolvedValue("OK");
    const handlers = new Map<string, ToolHandler>([["get_balance", handler]]);
    const router = new Router(handlers);

    const result = await router.handleCommand(
      makeEvent("/get_balance"),
      mockInstallation,
      mockHubClient,
    );

    expect(handler).toHaveBeenCalledOnce();
    expect(result).toBe("OK");
  });

  it("handler 抛异常应返回错误消息", async () => {
    const handler = vi.fn().mockRejectedValue(new Error("API 超时"));
    const handlers = new Map<string, ToolHandler>([["list_instances", handler]]);
    const router = new Router(handlers);

    const result = await router.handleCommand(
      makeEvent("list_instances"),
      mockInstallation,
      mockHubClient,
    );

    expect(result).toContain("命令执行失败");
    expect(result).toContain("API 超时");
  });

  it("event 为 null 时应返回 null", async () => {
    const router = new Router(new Map());

    const event: HubEvent = {
      v: 1,
      type: "event",
      trace_id: "trace-001",
      installation_id: "inst-001",
      bot: { id: "bot-001" },
    };

    const result = await router.handleCommand(event, mockInstallation, mockHubClient);
    expect(result).toBeNull();
  });
});
