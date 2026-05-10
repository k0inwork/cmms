import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import authRoutes from "./routes/auth.js";
import organizationRoutes from "./routes/organizations.js";
import siteRoutes from "./routes/sites.js";
import inspectionTemplateRoutes from "./routes/inspection-templates.js";
import turbineRoutes from "./routes/turbines.js";
import subsystemRoutes from "./routes/subsystems.js";
import componentRoutes from "./routes/components.js";
import assetRoutes from "./routes/assets.js";
import adminRoutes from "./routes/admin.js";
import evidenceRoutes from "./routes/evidence.js";
import inspectionRoutes from "./routes/inspections.js";
import syncRoutes from "./routes/sync.js";

const app = new Hono();

app.get("/", (c) => c.json({ status: "ok", service: "cmms", version: "0.1.0" }));

app.get("/health", (c) => c.json({ status: "healthy", timestamp: new Date().toISOString() }));

app.route("/auth", authRoutes);
app.route("/organizations", organizationRoutes);
app.route("/organizations/:orgId/sites", siteRoutes);
app.route("/templates", inspectionTemplateRoutes);
app.route("/organizations/:orgId/sites/:siteId/turbines", turbineRoutes);
app.route("/organizations/:orgId/sites/:siteId/turbines/:turbineId/subsystems", subsystemRoutes);
app.route("/organizations/:orgId/sites/:siteId/turbines/:turbineId/subsystems/:subsystemId/components", componentRoutes);
app.route("/assets", assetRoutes);
app.route("/admin", adminRoutes);
app.route("/evidence", evidenceRoutes);
app.route("/inspections", inspectionRoutes);
app.route("/sync", syncRoutes);

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
