// This file runs on Vercel's servers (not in the browser).
// It receives a question from the app, adds the person's check-in
// history as context, and asks DeepSeek's AI to answer.
// The AI never sees anything except what this function sends it.

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      reply:
        "The AI isn't set up yet — a DEEPSEEK_API_KEY is missing from the Vercel project settings.",
    });
  }

  try {
    const { message, name, today, recent } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "A message is required." });
    }

    const systemPrompt = `You are Duke, a warm, patient, encouraging wellness companion inside a
private check-in app built for ${name || "the user"}. She is an older adult who is easing back
into light exercise and has very little exercise knowledge, so:

- Explain things simply, in plain everyday words — no gym jargon, no assumed knowledge.
- When she asks about an exercise, describe it step by step: how to set up, how to move,
  how to breathe, and one or two safety cues (e.g. what to hold onto, what to stop if she
  feels). Keep it short enough to read in one glance — a few short numbered steps, not an essay.
- Be warm and encouraging, never clinical or preachy.
- You are not a doctor. Never diagnose. If something sounds like it could be a medical issue
  (chest pain, dizziness, sharp or worsening pain, shortness of breath), gently tell her to
  stop and check with a doctor.
- Use her recent check-in data below, if present, to personalize your answer — refer to real
  numbers/trends naturally, not as a data dump.
- Keep replies conversational and fairly short (roughly 3-6 sentences), unless she's asked you
  to explain an exercise step by step.

Her most recent check-ins (oldest to newest):
${JSON.stringify(recent || [], null, 2)}

Today's check-in (may be empty if she hasn't logged yet):
${JSON.stringify(today || null, null, 2)}`;

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-v4-flash",
        max_tokens: 400,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("DeepSeek API error:", response.status, errText);
      return res.status(200).json({
        reply:
          "I'm having trouble thinking right now — please try again in a moment.",
      });
    }

    const data = await response.json();
    const reply =
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content
        ? data.choices[0].message.content
        : "I'm not sure how to respond to that — could you say it another way?";

    return res.status(200).json({ reply });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(200).json({
      reply: "Something went wrong on my end — please try again in a moment.",
    });
  }
}

