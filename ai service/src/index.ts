import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// ─────────────────────────────────────────────────────────────
// Intent Classification
// Uses keyword + semantic heuristics; swap for a real model
// (e.g. HuggingFace zero-shot-classification) when deploying.
// ─────────────────────────────────────────────────────────────

type Intent = "action_item" | "decision" | "question" | "reference";

interface ClassifyRequest {
  text: string;
  nodeId?: string;
}

interface ClassifyResponse {
  nodeId?: string;
  text: string;
  intent: Intent;
  confidence: number;
  model: string;
}

function classifyText(text: string): { intent: Intent; confidence: number } {
  const l = text.toLowerCase();

  const scores: Record<Intent, number> = {
    action_item: 0,
    decision: 0,
    question: 0,
    reference: 0,
  };

  // Action item signals
  if (/\b(assign|ship|deploy|build|create|implement|fix|refactor|update|set up|write|review|test)\b/.test(l)) scores.action_item += 3;
  if (/\b(by|before|deadline|asap|urgent|priority)\b/.test(l)) scores.action_item += 2;
  if (/\b(action|todo|task)\b/.test(l)) scores.action_item += 2;
  if (/@\w+/.test(l)) scores.action_item += 1; // @mentions

  // Decision signals
  if (/\b(decided?|decision|choose|chose|going with|we will|use|adopt)\b/.test(l)) scores.decision += 3;
  if (/\b(approved?|agreed?|confirmed?|final)\b/.test(l)) scores.decision += 2;

  // Question signals
  if (/\?/.test(text)) scores.question += 3;
  if (/\b(should|would|could|can|who|what|when|where|why|how|open question)\b/.test(l)) scores.question += 2;
  if (/\b(thinking about|considering|unsure|unclear|need input|TBD)\b/.test(l)) scores.question += 1;

  // Reference signals
  if (/\b(reference|see|check|refer|link|ticket|jira|figma|doc|rfc|per|based on)\b/.test(l)) scores.reference += 3;
  if (/https?:\/\//.test(l)) scores.reference += 2;
  if (/\b(LIG-|JIRA-|GH-)\d+/.test(l)) scores.reference += 2;

  // Determine winner
  const entries = Object.entries(scores) as [Intent, number][];
  entries.sort((a, b) => b[1] - a[1]);
  const [topIntent, topScore] = entries[0];
  const total = entries.reduce((s, [, v]) => s + v, 0);
  const confidence = total > 0 ? Math.min(topScore / total, 1) : 0.25;

  return { intent: topIntent || "reference", confidence };
}

// ── REST Endpoint ─────────────────────────────────────────────
app.post("/classify", (req, res) => {
  const { text, nodeId } = req.body as ClassifyRequest;
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "text is required" });
  }
  const { intent, confidence } = classifyText(text);
  const result: ClassifyResponse = {
    nodeId,
    text,
    intent,
    confidence: Math.round(confidence * 100) / 100,
    model: "ligma-heuristic-v1",
  };
  console.log(`[AI] "${text.slice(0, 40)}" → ${intent} (${result.confidence})`);
  return res.json(result);
});

app.post("/classify/batch", (req, res) => {
  const { items } = req.body as { items: ClassifyRequest[] };
  if (!Array.isArray(items)) return res.status(400).json({ error: "items array required" });
  const results = items.map(({ text, nodeId }) => {
    const { intent, confidence } = classifyText(text || "");
    return { nodeId, text, intent, confidence: Math.round(confidence * 100) / 100, model: "ligma-heuristic-v1" };
  });
  return res.json({ results });
});

app.get("/health", (_req, res) => res.json({ status: "AI service OK", model: "ligma-heuristic-v1" }));

app.listen(PORT, () => console.log(`🤖 LIGMA AI Service → http://localhost:${PORT}`));
