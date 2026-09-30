import { describe, expect, it } from "vitest";
import { joinBase } from "./paths";

describe("joinBase", () => {
  it("joins the site base and a relative path", () => {
    expect(joinBase("/", "bundle.json")).toBe("/bundle.json");
    expect(joinBase("/zueri-kids", "bundle.json")).toBe("/zueri-kids/bundle.json");
    expect(joinBase("/zueri-kids/", "angebot/a/b/")).toBe("/zueri-kids/angebot/a/b/");
    expect(joinBase("/zueri-kids", "")).toBe("/zueri-kids/");
  });
});
