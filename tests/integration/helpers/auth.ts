import { prisma } from "./db.js";
import { hashPassword } from "../../../src/utils/password.js";
import { signAccessToken } from "../../../src/utils/jwt.js";

interface CreateTestUserOptions {
  email?: string;
  role?: string;
  organizationId: string;
  firstName?: string;
  lastName?: string;
}

export async function createTestUser(options: CreateTestUserOptions) {
  const email = options.email || `test-${crypto.randomUUID()}@example.com`;
  const user = await prisma.user.create({
    data: {
      email,
      password_hash: await hashPassword("Password123!"),
      first_name: options.firstName || "Test",
      last_name: options.lastName || "User",
      role: (options.role || "TECHNICIAN") as any,
      organization_id: options.organizationId,
    },
  });

  const token = signAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organization_id,
  });

  return { user, token };
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}
