import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createContext(role: "admin" | "teacher") {
  const now = new Date();
  const ctx: TrpcContext = {
    user: {
      id: role === "admin" ? 1 : 2,
      openId: `${role}-user`,
      name: role === "admin" ? "Administrador" : "Professor",
      email: `${role}@example.com`,
      loginMethod: "test",
      role,
      status: "active",
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
  return ctx;
}

describe("profile authorization", () => {
  it("blocks teachers from admin CRUD procedures", async () => {
    const caller = appRouter.createCaller(createContext("teacher"));
    await expect(caller.admin.schools.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.students.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.questions.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("passes authorization for admins before the database layer", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    await expect(caller.admin.schools.list()).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
