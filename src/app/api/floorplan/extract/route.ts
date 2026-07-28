import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient } from "@/lib/anthropic";

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB — generous for a phone photo or scanned PDF
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
const PDF_TYPE = "application/pdf";

const EXTRACTION_PROMPT = `This file shows a floor plan for a home. Identify each distinct floor if there is more than one (e.g. ground floor, first floor). For each floor, list every distinct room with:
- a short descriptive name (e.g. "Living Room", "Bedroom")
- realistic real-world width and depth in centimetres
- an x/y position in centimetres for the room's top-left corner, relative to the top-left of the whole floor as the origin (larger x = further right, larger y = further down), reflecting where it actually sits relative to the other rooms

If exact dimensions aren't labelled on the plan, estimate them as accurately as you can from the drawing's proportions and any dimensions that are labelled elsewhere. Suggest a short name for each floor (e.g. "Ground floor", "First floor").`;

const FLOORPLAN_SCHEMA = {
  type: "object",
  properties: {
    floors: {
      type: "array",
      items: {
        type: "object",
        properties: {
          suggestedAreaName: { type: "string" },
          rooms: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                width_cm: { type: "number" },
                depth_cm: { type: "number" },
                x_cm: { type: "number" },
                y_cm: { type: "number" },
              },
              required: ["name", "width_cm", "depth_cm", "x_cm", "y_cm"],
              additionalProperties: false,
            },
          },
        },
        required: ["suggestedAreaName", "rooms"],
        additionalProperties: false,
      },
    },
  },
  required: ["floors"],
  additionalProperties: false,
} as const;

export interface ExtractedRoom {
  name: string;
  width_cm: number;
  depth_cm: number;
  x_cm: number;
  y_cm: number;
}

export interface ExtractedFloor {
  suggestedAreaName: string;
  rooms: ExtractedRoom[];
}

export interface ExtractResponse {
  floors: ExtractedFloor[];
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const isPdf = file.type === PDF_TYPE;
  const isImage = (ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type);
  if (!isPdf && !isImage) {
    return NextResponse.json(
      { error: "Unsupported file type — upload a photo (JPEG/PNG/GIF/WebP) or a PDF" },
      { status: 400 },
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File is too large (20MB max)" }, { status: 400 });
  }

  let client;
  try {
    client = getAnthropicClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI extraction is not configured" },
      { status: 500 },
    );
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const fileBlock = isPdf
    ? ({
        type: "document",
        source: { type: "base64", media_type: "application/pdf" as const, data: base64 },
      } as const)
    : ({
        type: "image",
        source: { type: "base64", media_type: file.type as (typeof ALLOWED_IMAGE_TYPES)[number], data: base64 },
      } as const);

  let response;
  try {
    response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { format: { type: "json_schema", schema: FLOORPLAN_SCHEMA } },
      messages: [
        {
          role: "user",
          content: [fileBlock, { type: "text", text: EXTRACTION_PROMPT }],
        },
      ],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI extraction request failed" },
      { status: 502 },
    );
  }

  if (response.stop_reason === "refusal") {
    return NextResponse.json(
      { error: "Couldn't read this floor plan — try a clearer photo or a different file" },
      { status: 422 },
    );
  }

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return NextResponse.json({ error: "AI extraction returned no readable result" }, { status: 502 });
  }

  let parsed: ExtractResponse;
  try {
    parsed = JSON.parse(textBlock.text) as ExtractResponse;
  } catch {
    return NextResponse.json({ error: "AI extraction returned malformed data" }, { status: 502 });
  }

  return NextResponse.json(parsed);
}
