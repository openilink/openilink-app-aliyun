/**
 * tools/dns.ts 测试
 * Mock AliyunClient 验证 DNS 工具的 handler 和定义
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { dnsTools } from "../../src/tools/dns.js";
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

describe("dnsTools", () => {
  describe("tool definitions", () => {
    it("应包含 4 个 DNS 相关工具定义", () => {
      expect(dnsTools.definitions).toHaveLength(4);
      const names = dnsTools.definitions.map((d) => d.name);
      expect(names).toContain("list_domains");
      expect(names).toContain("list_dns_records");
      expect(names).toContain("add_dns_record");
      expect(names).toContain("delete_dns_record");
    });

    it("add_dns_record 应要求 domain, rr, type, value 为必填", () => {
      const addDef = dnsTools.definitions.find((d) => d.name === "add_dns_record");
      expect(addDef?.parameters?.required).toContain("domain");
      expect(addDef?.parameters?.required).toContain("rr");
      expect(addDef?.parameters?.required).toContain("type");
      expect(addDef?.parameters?.required).toContain("value");
    });
  });

  describe("createHandlers", () => {
    let client: ReturnType<typeof createMockClient>;
    let handlers: Map<string, any>;

    beforeEach(() => {
      client = createMockClient();
      handlers = dnsTools.createHandlers(client);
    });

    describe("list_domains", () => {
      it("应返回域名列表", async () => {
        client.request.mockResolvedValue({
          Domains: {
            Domain: [
              {
                DomainName: "example.com",
                RecordCount: 5,
                DnsServers: { DnsServer: ["dns1.hichina.com", "dns2.hichina.com"] },
              },
            ],
          },
        });

        const handler = handlers.get("list_domains")!;
        const result = await handler(makeCtx({}));
        expect(result).toContain("域名列表");
        expect(result).toContain("example.com");
      });

      it("无域名时应返回提示", async () => {
        client.request.mockResolvedValue({ Domains: { Domain: [] } });

        const handler = handlers.get("list_domains")!;
        const result = await handler(makeCtx({}));
        expect(result).toContain("暂无域名");
      });
    });

    describe("list_dns_records", () => {
      it("应返回解析记录", async () => {
        client.request.mockResolvedValue({
          DomainRecords: {
            Record: [
              {
                RecordId: "rec-001",
                RR: "www",
                Type: "A",
                Value: "1.2.3.4",
                TTL: 600,
                Status: "ENABLE",
              },
            ],
          },
        });

        const handler = handlers.get("list_dns_records")!;
        const result = await handler(makeCtx({ domain: "example.com" }));
        expect(result).toContain("www.example.com");
        expect(result).toContain("1.2.3.4");
        expect(result).toContain("启用");
      });
    });

    describe("add_dns_record", () => {
      it("应成功添加解析记录", async () => {
        client.request.mockResolvedValue({ RecordId: "rec-new-001" });

        const handler = handlers.get("add_dns_record")!;
        const result = await handler(
          makeCtx({ domain: "example.com", rr: "www", type: "A", value: "1.2.3.4" }),
        );
        expect(result).toContain("添加成功");
        expect(result).toContain("www.example.com");
        expect(result).toContain("rec-new-001");
      });
    });

    describe("delete_dns_record", () => {
      it("应成功删除解析记录", async () => {
        client.request.mockResolvedValue({ RecordId: "rec-001" });

        const handler = handlers.get("delete_dns_record")!;
        const result = await handler(makeCtx({ record_id: "rec-001" }));
        expect(result).toContain("已删除");
        expect(result).toContain("rec-001");
      });
    });
  });
});
