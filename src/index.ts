import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { HTTPException } from "hono/http-exception";
import { mkdirSync } from "fs";
import { hasErrorCode } from "./utils/errors.js";
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
import ticketRoutes from "./routes/tickets.js";
import technicianRoutes from "./routes/technicians.js";
import replacementRoutes from "./routes/replacements.js";
import dispatchRoutes from "./routes/dispatch.js";
import workOrderRoutes from "./routes/work-orders.js";
import searchRoutes from "./routes/search.js";
import auditRoutes from "./routes/audit.js";
import reportRoutes from "./routes/reports.js";
import {
  prodCors,
  prodSecureHeaders,
  prodRequestId,
  structuredLogger,
  rateLimiter,
} from "./middleware/production.js";

// Ensure uploads directory exists
mkdirSync("uploads", { recursive: true });

const app = new Hono();

// Apply production middleware
app.use("*", prodRequestId());
app.use("*", structuredLogger());
app.use("*", prodSecureHeaders());
app.use("*", prodCors());
app.use("*", rateLimiter());

app.get("/", (c) => c.json({ status: "ok", service: "cmms", version: "0.1.0" }));

app.get("/health", (c) => c.json({ status: "healthy", timestamp: new Date().toISOString() }));

// Serve uploaded files statically
app.use("/uploads/*", serveStatic({ root: "./" }));

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
app.route("/tickets", ticketRoutes);
app.route("/technicians", technicianRoutes);
app.route("/replacements", replacementRoutes);
app.route("/dispatch", dispatchRoutes);
app.route("/work-orders", workOrderRoutes);
app.route("/search", searchRoutes);
app.route("/audit", auditRoutes);
app.route("/reports", reportRoutes);

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    const body: Record<string, unknown> = { error: err.message };
    if (hasErrorCode(err)) {
      body.code = err.code;
    }
    return c.json(body, err.status);
  }
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

const port = Number(process.env.PORT) || 3000;

console.log(`CMMS API starting on port ${port}`);

serve({ port, fetch: app.fetch }, () => {
  console.log(`Server running on http://localhost:${port}`);
});
