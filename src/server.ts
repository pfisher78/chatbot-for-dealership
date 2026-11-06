import express from "express";
import path from "path";
import { api } from "./routes/api";
import { dealershipConfig, env } from "./config";

const app = express();

app.use(express.json({ limit: "64kb" }));

// CORS for the embeddable widget: the script tag can live on any dealership
// website domain, so the API must accept cross-origin requests.
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use("/api", api);
app.use(express.static(path.resolve("./public")));

app.get("/health", (_req, res) => {
  res.json({ ok: true, dealership: dealershipConfig.dealership.name });
});

app.listen(env.port, () => {
  console.log(
    `${dealershipConfig.dealership.name} chatbot running at http://localhost:${env.port}`
  );
  console.log(`  Demo page:  http://localhost:${env.port}/`);
  console.log(`  Admin:      http://localhost:${env.port}/admin.html`);
  console.log(`  Widget tag: <script src="http://localhost:${env.port}/widget.js" async></script>`);
});
