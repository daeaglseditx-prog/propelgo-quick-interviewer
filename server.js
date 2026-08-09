import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const instructions = `
You are Apoorv's fast, realistic PropelGO fresher SDE interviewer.
The candidate is an ECE student moving toward software development and has a
major MERN project called FoodieK. Conduct a natural interview one question at a time.

RESPONSE STYLE:
- Give enough content to understand/correct an answer, but never a long lecture.
- Explanations should usually be 50-120 words.
- Ask exactly ONE clear next question.
- Prefer follow-ups based on the candidate's answer.
- Do not reveal an ideal answer before the candidate attempts it.
- If good, briefly acknowledge the strongest point and continue.
- If incomplete/wrong, briefly explain the key correction and continue.
- Keep the conversation fast.

COVER:
HR, ECE-to-SDE, why software, why PropelGO, strengths/weaknesses, teamwork,
JavaScript, Node.js, Express, REST, React, MongoDB, SQL, OOP, DBMS, OS, CN,
JWT, APIs, basic system design, FoodieK architecture and personal contribution,
Redis, BullMQ, Socket.IO, Razorpay, Docker, AWS/EC2, CI/CD, security, debugging,
and DSA fundamentals.
When the interview starts, ask the first question immediately.
`;

app.get("/api/health", (_, res) => res.json({ok:true}));

app.post("/api/realtime", async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY)
      return res.status(500).json({error:"OPENAI_API_KEY is missing on the server."});
    if (!req.body?.sdp)
      return res.status(400).json({error:"Missing SDP offer."});

    const session = {
      type: "realtime",
      model: "gpt-realtime",
      output_modalities: ["text"],
      instructions,
      audio: {
        input: {
          transcription: {model:"gpt-4o-mini-transcribe", language:"en"},
          turn_detection: {
            type:"semantic_vad",
            eagerness:"medium",
            create_response:true,
            interrupt_response:true
          }
        }
      },
      max_output_tokens:600
    };

    const form = new FormData();
    form.append("sdp", new Blob([req.body.sdp], {type:"application/sdp"}), "offer.sdp");
    form.append("session", new Blob([JSON.stringify(session)], {type:"application/json"}), "session.json");

    const r = await fetch("https://api.openai.com/v1/realtime/calls", {
      method:"POST",
      headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},
      body:form
    });
    const body = await r.text();
    if (!r.ok) return res.status(r.status).send(body);
    res.type("application/sdp").send(body);
  } catch (e) {
    console.error(e);
    res.status(500).json({error:e.message});
  }
});

app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "API route not found" });
  }

  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => console.log(`Running on http://localhost:${PORT}`));
