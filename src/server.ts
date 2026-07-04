import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { handleBuild } from "./builder.js";
import { initEcc } from "./compat.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "1mb" }));
initEcc();

const webDir = path.resolve(__dirname, "..", "web");
const fixturesDir = path.resolve(__dirname, "..", "fixtures");

app.use(express.static(webDir));
app.use("/fixtures", express.static(fixturesDir));

app.get("/api/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.post("/api/build", (req, res) => {
  const report = handleBuild(req.body);
  if (!report.ok) {
    res.status(400).json(report);
    return;
  }
  res.status(200).json(report);
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(webDir, "index.html"));
});

const port = Number(process.env.PORT || 3000);
const url = `http://127.0.0.1:${port}`;
app.listen(port, () => {
  console.log(url);
});
