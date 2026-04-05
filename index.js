import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function main() {
  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "user", content: "こんにちは、自己紹介して" }
    ],
  });

  console.log(res.choices[0].message.content);
}

main();