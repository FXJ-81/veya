import OpenAI from "openai";
import { NextResponse } from "next/server";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  const { message } = await req.json();

  const response = await client.responses.create({
    model: "gpt-5.4-nano", // 👈 THIS is the model line
    input: message,
  });

  return NextResponse.json({
    reply: response.output_text,
  });
}
