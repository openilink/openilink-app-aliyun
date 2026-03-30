/**
 * manifest.ts 测试
 * 验证 Manifest 生成逻辑
 */
import { describe, it, expect } from "vitest";
import { getManifest } from "../../src/hub/manifest.js";
import type { Config } from "../../src/config.js";

describe("getManifest", () => {
  const mockConfig: Config = {
    port: "8100",
    hubUrl: "http://hub.test",
    baseUrl: "http://app.test",
    dbPath: "data/aliyun.db",
    aliyunAccessKeyId: "test-id",
    aliyunAccessKeySecret: "test-secret",
    aliyunRegion: "cn-hangzhou",
  };

  it("应生成正确的 slug 和 name", () => {
    const manifest = getManifest(mockConfig);
    expect(manifest.slug).toBe("aliyun");
    expect(manifest.name).toBe("阿里云");
    expect(manifest.icon).toBe("☁️");
  });

  it("应包含正确的 URL 配置", () => {
    const manifest = getManifest(mockConfig);
    expect(manifest.oauth_setup_url).toBe("http://app.test/oauth/setup");
    expect(manifest.oauth_redirect_url).toBe("http://app.test/oauth/redirect");
    expect(manifest.webhook_url).toBe("http://app.test/hub/webhook");
  });

  it("config_schema 应包含 AccessKey 配置", () => {
    const manifest = getManifest(mockConfig);
    const schema = manifest.config_schema as any;
    expect(schema.properties.aliyun_access_key_id).toBeDefined();
    expect(schema.properties.aliyun_access_key_secret).toBeDefined();
    expect(schema.properties.aliyun_region).toBeDefined();
    expect(schema.required).toContain("aliyun_access_key_id");
    expect(schema.required).toContain("aliyun_access_key_secret");
  });

  it("传入 tools 时应正确包含在 manifest 中", () => {
    const tools = [
      {
        name: "list_instances",
        description: "列出 ECS 实例",
        command: "list_instances",
      },
    ];
    const manifest = getManifest(mockConfig, tools);
    expect(manifest.tools).toHaveLength(1);
    expect(manifest.tools[0].name).toBe("list_instances");
  });
});
