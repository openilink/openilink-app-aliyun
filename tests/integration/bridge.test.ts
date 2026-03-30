/**
 * 阿里云 App 集成测试
 *
 * 测试 Hub <-> App 的完整通信链路：
 * 1. Mock Hub Server 模拟 OpeniLink Hub
 * 2. 创建轻量 App HTTP 服务器（仅含 webhook handler + router）
 * 3. 使用内存 SQLite 存储 + Mock AliyunClient
 * 4. 验证命令路由和工具执行
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import http from "node:http";
import { Store } from "../../src/store.js";
import { handleWebhook } from "../../src/hub/webhook.js";
import { HubClient } from "../../src/hub/client.js";
import { Router } from "../../src/router.js";
import { collectAllTools } from "../../src/tools/index.js";
import {
  startMockHub,
  injectCommand,
  MOCK_HUB_URL,
  MOCK_WEBHOOK_SECRET,
  MOCK_APP_TOKEN,
  MOCK_INSTALLATION_ID,
  MOCK_BOT_ID,
  APP_PORT,
} from "./setup.js";

// ─── Mock AliyunClient ───

function createMockAliyunClient() {
  return {
    getRegion: vi.fn().mockReturnValue("cn-hangzhou"),
    request: vi.fn().mockImplementation(
      async (endpoint: string, action: string, params?: Record<string, string>) => {
        // 根据 Action 返回对应的模拟数据
        switch (action) {
          case "DescribeInstances":
            return {
              Instances: {
                Instance: [
                  {
                    InstanceId: "i-mock001",
                    InstanceName: "Mock 服务器",
                    Status: "Running",
                    InstanceType: "ecs.c6.large",
                    Cpu: 2,
                    Memory: 4096,
                    OSName: "Ubuntu 22.04",
                    PublicIpAddress: { IpAddress: ["10.0.0.1"] },
                    VpcAttributes: { PrivateIpAddress: { IpAddress: ["192.168.1.1"] } },
                    ZoneId: "cn-hangzhou-h",
                    InstanceChargeType: "PostPaid",
                    CreationTime: "2024-01-01T00:00:00Z",
                    ExpiredTime: "",
                  },
                ],
              },
            };
          case "StartInstance":
          case "StopInstance":
          case "RebootInstance":
            return { RequestId: "req-mock-001" };
          case "DescribeDomains":
            return {
              Domains: {
                Domain: [
                  {
                    DomainName: "mock.example.com",
                    RecordCount: 3,
                    DnsServers: { DnsServer: ["dns1.hichina.com"] },
                  },
                ],
              },
            };
          case "DescribeDomainRecords":
            return {
              DomainRecords: {
                Record: [
                  {
                    RecordId: "rec-mock-001",
                    RR: "www",
                    Type: "A",
                    Value: "10.0.0.1",
                    TTL: 600,
                    Status: "ENABLE",
                  },
                ],
              },
            };
          case "AddDomainRecord":
            return { RecordId: "rec-mock-new" };
          case "DeleteDomainRecord":
            return { RecordId: params?.RecordId ?? "" };
          case "QueryAccountBalance":
            return {
              Data: {
                AvailableAmount: "9999.99",
                CreditAmount: "0",
                Currency: "CNY",
              },
            };
          case "QueryBillOverview":
            return {
              Data: {
                Items: {
                  Item: [
                    { ProductName: "云服务器 ECS", PretaxAmount: "500.00" },
                  ],
                },
              },
            };
          case "DescribeSecurityGroups":
            return {
              SecurityGroups: {
                SecurityGroup: [
                  {
                    SecurityGroupId: "sg-mock001",
                    SecurityGroupName: "Mock 安全组",
                    SecurityGroupType: "normal",
                    VpcId: "vpc-mock001",
                    Description: "测试安全组",
                  },
                ],
              },
            };
          default:
            return { RequestId: "req-default" };
        }
      },
    ),
  } as any;
}

// ─── 测试主体 ───

describe("阿里云 App 集成测试", () => {
  let mockHubHandle: { server: http.Server; close: () => Promise<void> };
  let appServer: http.Server;
  let store: Store;
  let router: Router;

  beforeAll(async () => {
    // 1. 启动 Mock Hub Server
    mockHubHandle = await startMockHub();

    // 2. 初始化内存数据库和存储
    store = new Store(":memory:");

    // 3. 注入 installation 记录（模拟已完成 OAuth 安装）
    store.saveInstallation({
      id: MOCK_INSTALLATION_ID,
      hubUrl: MOCK_HUB_URL,
      appId: "aliyun",
      botId: MOCK_BOT_ID,
      appToken: MOCK_APP_TOKEN,
      webhookSecret: MOCK_WEBHOOK_SECRET,
      createdAt: new Date().toISOString(),
    });

    // 4. 使用 Mock AliyunClient 收集工具并创建路由
    const mockClient = createMockAliyunClient();
    const { handlers } = collectAllTools(mockClient);
    router = new Router(handlers);

    // 5. 启动轻量 App HTTP 服务器
    appServer = http.createServer(async (req, res) => {
      const url = new URL(req.url!, `http://localhost:${APP_PORT}`);

      if (req.method === "POST" && url.pathname === "/hub/webhook") {
        await handleWebhook(req, res, {
          store,
          onCommand: async (event, installation) => {
            if (!event.event) return null;
            const hubClient = new HubClient(installation.hubUrl, installation.appToken);
            return router.handleCommand(event, installation, hubClient);
          },
          getHubClient: (installation) =>
            new HubClient(installation.hubUrl, installation.appToken),
        });
        return;
      }

      if (url.pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));
        return;
      }

      res.writeHead(404);
      res.end("Not Found");
    });

    await new Promise<void>((resolve, reject) => {
      appServer.on("error", reject);
      appServer.listen(APP_PORT, () => {
        console.log(`[test] App Server 已启动，端口 ${APP_PORT}`);
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) =>
      appServer.close(() => {
        console.log("[test] App Server 已关闭");
        resolve();
      }),
    );
    await mockHubHandle.close();
    store.close();
  });

  // ─── 基础健康检查 ───

  it("Mock Hub Server 健康检查", async () => {
    const res = await fetch(`${MOCK_HUB_URL}/health`);
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data).toEqual({ status: "ok" });
  });

  it("App Server 健康检查", async () => {
    const res = await fetch(`http://localhost:${APP_PORT}/health`);
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data).toEqual({ status: "ok" });
  });

  // ─── 命令执行测试 ───

  it("list_instances 命令应通过 Hub 链路返回 ECS 实例列表", async () => {
    const result = await injectCommand("list_instances", {});

    expect(result.app_response.reply_type).toBe("text");
    expect(result.app_response.reply_base64).toBeDefined();
    const reply = Buffer.from(result.app_response.reply_base64, "base64").toString("utf-8");
    expect(reply).toContain("Mock 服务器");
    expect(reply).toContain("i-mock001");
  });

  it("get_balance 命令应返回余额信息", async () => {
    const result = await injectCommand("get_balance", {});

    expect(result.app_response.reply_base64).toBeDefined();
    const reply = Buffer.from(result.app_response.reply_base64, "base64").toString("utf-8");
    expect(reply).toContain("9999.99");
    expect(reply).toContain("CNY");
  });

  it("list_domains 命令应返回域名列表", async () => {
    const result = await injectCommand("list_domains", {});

    const reply = Buffer.from(result.app_response.reply_base64, "base64").toString("utf-8");
    expect(reply).toContain("mock.example.com");
  });

  it("list_security_groups 命令应返回安全组列表", async () => {
    const result = await injectCommand("list_security_groups", {});

    const reply = Buffer.from(result.app_response.reply_base64, "base64").toString("utf-8");
    expect(reply).toContain("Mock 安全组");
    expect(reply).toContain("sg-mock001");
  });

  it("未知命令应返回错误提示", async () => {
    const result = await injectCommand("nonexistent_command", {});

    const reply = Buffer.from(result.app_response.reply_base64, "base64").toString("utf-8");
    expect(reply).toContain("未知命令");
  });

  // ─── Webhook 验证测试 ───

  it("无效签名的 webhook 请求应被拒绝（401）", async () => {
    const hubEvent = {
      v: 1,
      type: "event",
      trace_id: "tr_bad_sig",
      installation_id: MOCK_INSTALLATION_ID,
      bot: { id: MOCK_BOT_ID },
      event: {
        type: "command",
        id: "evt_bad",
        timestamp: Math.floor(Date.now() / 1000),
        data: { command: "list_instances", args: {}, user_id: "hacker" },
      },
    };

    const res = await fetch(`http://localhost:${APP_PORT}/hub/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Timestamp": "12345",
        "X-Signature": "sha256=invalid_signature_here",
      },
      body: JSON.stringify(hubEvent),
    });

    expect(res.status).toBe(401);
  });

  it("url_verification 请求应正确返回 challenge", async () => {
    const verifyEvent = {
      v: 1,
      type: "url_verification",
      challenge: "test_challenge_token_123",
    };

    const res = await fetch(`http://localhost:${APP_PORT}/hub/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(verifyEvent),
    });

    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data).toEqual({ challenge: "test_challenge_token_123" });
  });
});
