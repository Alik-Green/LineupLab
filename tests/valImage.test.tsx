import { describe, it, expect } from "vitest";
import ValImage from "../src/components/ValImage";

describe("ValImage fallback", () => {
  it("should export component", () => {
    expect(ValImage).toBeDefined();
    expect(typeof ValImage).toBe("function");
  });
});
