/**
 * tools/ecs.ts 测试
 * Mock AliyunClient 验证 ECS 工具的 handler 和定义
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ecsTools } from "../../src/tools/ecs.js";
import type { ToolContext } from "../../src/hub/types.js";

/** 创建模拟的 AliyunClient */
function createMockClient() {
  return {
    getRegion: vi.fn().mockReturnValue("cn-hangzhou"),
    request: vi.fn(),
  } as any;
}

/** 创建测试用 ToolContext */
function makeCtx(args: Record<string, any>): ToolContext {
  return {
    installationId: "inst-001",
    botId: "bot-001",
    userId: "user-001",
    traceId: "trace-001",
    args,
  };
}

describe("ecsTools", () => {
  describe("tool definitions 结构", () => {
    it("应包含 5 个 ECS 相关工具定义", () => {
      expect(ecsTools.definitions).toHaveLength(5);

      const names = ecsTools.definitions.map((d) => d.name);
      expect(names).toContain("list_instances");
      expect(names).toContain("get_instance");
      expect(names).toContain("start_instance");
      expect(names).toContain("stop_instance");
      expect(names).toContain("reboot_instance");
    });

    it("每个定义应包含 name, description, command 字段", () => {
      for (const def of ecsTools.definitions) {
        expect(def.name).toBeTruthy();
        expect(def.description).toBeTruthy();
        expect(def.command).toBeTruthy();
      }
    });

    it("get_instance 应要求 instance_id 为必填", () => {
      const getDef = ecsTools.definitions.find((d) => d.name === "get_instance");
      expect(getDef?.parameters?.required).toContain("instance_id");
    });
  });

  describe("createHandlers", () => {
    let client: ReturnType<typeof createMockClient>;
    let handlers: Map<string, any>;

    beforeEach(() => {
      client = createMockClient();
      handlers = ecsTools.createHandlers(client);
    });

    it("应创建与 definitions 对应的 handler", () => {
      for (const def of ecsTools.definitions) {
        expect(handlers.has(def.command)).toBe(true);
      }
    });

    describe("list_instances", () => {
      it("应返回格式化的实例列表", async () => {
        client.request.mockResolvedValue({
          Instances: {
            Instance: [
              {
                InstanceId: "i-test001",
                InstanceName: "测试服务器",
                Status: "Running",
                InstanceType: "ecs.c6.large",
                PublicIpAddress: { IpAddress: ["1.2.3.4"] },
              },
            ],
          },
        });

        const handler = handlers.get("list_instances")!;
        const result = await handler(makeCtx({}));

        expect(client.request).toHaveBeenCalledOnce();
        expect(result).toContain("ECS 实例列表");
        expect(result).toContain("测试服务器");
        expect(result).toContain("Running");
        expect(result).toContain("1.2.3.4");
      });

      it("无实例时应返回提示", async () => {
        client.request.mockResolvedValue({
          Instances: { Instance: [] },
        });

        const handler = handlers.get("list_instances")!;
        const result = await handler(makeCtx({}));
        expect(result).toContain("暂无 ECS 实例");
      });
    });

    describe("get_instance", () => {
      it("应返回实例详情", async () => {
        client.request.mockResolvedValue({
          Instances: {
            Instance: [
              {
                InstanceId: "i-test001",
                InstanceName: "Web 服务器",
                Status: "Running",
                InstanceType: "ecs.c6.large",
                Cpu: 2,
                Memory: 4096,
                OSName: "Ubuntu 22.04",
                PublicIpAddress: { IpAddress: ["1.2.3.4"] },
                VpcAttributes: {
                  PrivateIpAddress: { IpAddress: ["192.168.1.100"] },
                },
                ZoneId: "cn-hangzhou-h",
                InstanceChargeType: "PostPaid",
                CreationTime: "2024-01-01T00:00:00Z",
                ExpiredTime: "",
              },
            ],
          },
        });

        const handler = handlers.get("get_instance")!;
        const result = await handler(makeCtx({ instance_id: "i-test001" }));

        expect(result).toContain("Web 服务器");
        expect(result).toContain("i-test001");
        expect(result).toContain("Running");
        expect(result).toContain("ecs.c6.large");
        expect(result).toContain("2 核");
        expect(result).toContain("4096 MB");
        expect(result).toContain("1.2.3.4");
        expect(result).toContain("按量付费");
      });

      it("实例不存在时应返回提示", async () => {
        client.request.mockResolvedValue({
          Instances: { Instance: [] },
        });

        const handler = handlers.get("get_instance")!;
        const result = await handler(makeCtx({ instance_id: "i-nonexist" }));
        expect(result).toContain("未找到实例");
      });
    });

    describe("start_instance", () => {
      it("应成功发送启动指令", async () => {
        client.request.mockResolvedValue({ RequestId: "req-001" });

        const handler = handlers.get("start_instance")!;
        const result = await handler(makeCtx({ instance_id: "i-test001" }));

        expect(result).toContain("启动指令已发送");
        expect(result).toContain("i-test001");
      });

      it("API 出错时应返回错误消息", async () => {
        client.request.mockRejectedValue(new Error("权限不足"));

        const handler = handlers.get("start_instance")!;
        const result = await handler(makeCtx({ instance_id: "i-test001" }));
        expect(result).toContain("启动实例失败");
        expect(result).toContain("权限不足");
      });
    });

    describe("stop_instance", () => {
      it("应成功发送停止指令", async () => {
        client.request.mockResolvedValue({ RequestId: "req-002" });

        const handler = handlers.get("stop_instance")!;
        const result = await handler(makeCtx({ instance_id: "i-test001" }));
        expect(result).toContain("停止指令已发送");
      });
    });

    describe("reboot_instance", () => {
      it("应成功发送重启指令", async () => {
        client.request.mockResolvedValue({ RequestId: "req-003" });

        const handler = handlers.get("reboot_instance")!;
        const result = await handler(makeCtx({ instance_id: "i-test001" }));
        expect(result).toContain("重启指令已发送");
      });
    });
  });
});
