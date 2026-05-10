import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import authRoutes from "./routes/auth.js";
import organizationRoutes from "./routes/organizations.js";
import siteRoutes from "./routes/sites.js";

const app = new Hono();

app.get("/", (c) => c.json({ status: "ok", service: "cmms", version: "0.1.0" }));

app.get("/health", (c) => c.json({ status: "healthy", timestamp: new Date().toISOString() }));

app.route("/auth", authRoutes);
app.route("/organizations", organizationRoutes);
app.route("/organizations/:orgId/sites", siteRoutes);

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

const port = Number(process.env.PORT) || 3000;

console.log(`CMMS API starting on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
