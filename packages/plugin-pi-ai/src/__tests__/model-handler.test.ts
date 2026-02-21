import { describe, expect, it } from "bun:test";
import { validatePublicImageUrl } from "../model-handler.ts";

describe("validatePublicImageUrl", () => {
  it("rejects non-https urls", async () => {
    await expect(
      validatePublicImageUrl("http://example.com/image.png"),
    ).rejects.toThrow("must use https://");
  });

  it("rejects localhost", async () => {
    await expect(
      validatePublicImageUrl("https://localhost/image.png"),
    ).rejects.toThrow("blocked host");
  });

  it("rejects private ip ranges", async () => {
    await expect(
      validatePublicImageUrl("https://192.168.1.9/image.png"),
    ).rejects.toThrow("blocked host");
  });

  it("rejects malformed urls", async () => {
    await expect(validatePublicImageUrl("not-a-url")).rejects.toThrow(
      "valid absolute URL",
    );
  });

  it("accepts public ip literal urls", async () => {
    const parsed = await validatePublicImageUrl("https://1.1.1.1/image.png");
    expect(parsed.hostname).toBe("1.1.1.1");
  });
});
