import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function adminContext(): TrpcContext {
  const now = new Date();
  return {
    user: { id: 1, openId: "report-admin", name: "Admin", email: "admin@example.com", loginMethod: "test", role: "admin", status: "active", createdAt: now, updatedAt: now, lastSignedIn: now },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("report modes", () => {
  it.each(["general", "class", "student"] as const)("accepts the %s report contract", async (reportType) => {
    const caller = appRouter.createCaller(adminContext());
    await expect(caller.reports({ reportType })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
