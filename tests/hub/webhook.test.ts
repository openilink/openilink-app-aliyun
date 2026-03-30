/**
 * webhook.ts 测试
 * 验证签名验证和事件分发逻辑
 */
import { describe, it, expect } from "vitest";
import { verifySignature } from "../../src/utils/crypto.js";
import { createHmac } from "node:crypto";

describe("verifySignature", () => {
  const secret = "test-secret";
  const timestamp = "1700000000";
  const body = Buffer.from('{"test": true}');

  /** 计算正确的签名 */
  function computeSignature(): string {
    const mac = createHmac("sha256", secret);
    mac.update(timestamp + ":");
    mac.update(body);
    return "sha256=" + mac.digest("hex");
  }

  it("正确的签名应验证通过", () => {
    const sig = computeSignature();
    expect(verifySignature(secret, timestamp, body, sig)).toBe(true);
  });

  it("错误的签名应验证失败", () => {
    expect(verifySignature(secret, timestamp, body, "sha256=invalid")).toBe(false);
  });

  it("空 secret 应验证失败", () => {
    const sig = computeSignature();
    expect(verifySignature("", timestamp, body, sig)).toBe(false);
  });

  it("空 timestamp 应验证失败", () => {
    const sig = computeSignature();
    expect(verifySignature(secret, "", body, sig)).toBe(false);
  });

  it("空 signature 应验证失败", () => {
    expect(verifySignature(secret, timestamp, body, "")).toBe(false);
  });

  it("篡改 body 后签名应验证失败", () => {
    const sig = computeSignature();
    const tamperedBody = Buffer.from('{"test": false}');
    expect(verifySignature(secret, timestamp, tamperedBody, sig)).toBe(false);
  });
});
