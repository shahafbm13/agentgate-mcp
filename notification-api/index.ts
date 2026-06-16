import express from "express";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.NOTIFICATION_API_PORT ?? 9001);
const API_KEY = process.env.NOTIFICATION_API_KEY ?? "dev-notification-key";

const app = express();
app.use(express.json());

const deliveries: Array<Record<string, unknown>> = [];

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "notification-api" });
});

app.post("/notify", (req, res) => {
  const key = req.headers["x-api-key"];
  if (key !== API_KEY) {
    res.status(401).json({ error: "unauthorized", message: "Invalid API key" });
    return;
  }

  const deliveryId = randomUUID();
  const record = {
    deliveryId,
    receivedAt: new Date().toISOString(),
    payload: req.body,
  };
  deliveries.push(record);
  console.log("[notification-api] delivery:", JSON.stringify(record));

  res.status(202).json({
    deliveryId,
    status: "queued",
    channel: "simulated-slack",
  });
});

app.get("/deliveries", (req, res) => {
  const key = req.headers["x-api-key"];
  if (key !== API_KEY) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  res.json({ deliveries, count: deliveries.length });
});

app.listen(PORT, () => {
  console.log(`Notification API listening on http://localhost:${PORT}`);
});
