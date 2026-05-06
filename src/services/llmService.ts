import { GoogleGenAI, Type } from "@google/genai";
import { AppSettings, ProcessedProvision } from "../types";

const SYSTEM_PROMPT = `You are an aviation regulatory document processor.

Your role is to convert raw extracted text from aviation documents (e.g., ICAO Annexes, Doc 4444, EASA regulations) into a structured, machine-readable dataset suitable for retrieval systems.

CORE PRINCIPLE (NON-NEGOTIABLE)
You are NOT allowed to change the meaning of the text.
Do NOT paraphrase
Do NOT summarize
Do NOT simplify
Do NOT complete missing sentences
Do NOT infer missing content
You must preserve the original wording exactly.

TASK
Given a block of raw text, extract and structure it into a single JSON object.

WHAT TO IDENTIFY
1. Document Structure:
"document" (e.g., "ICAO Annex 11", if present)
"chapter" (e.g., "Chapter 2")
"section" (e.g., "2.1")
"subsection" (if present)
"heading" (title of the section)
If not explicitly present → leave as empty string.

2. Main Text (CRITICAL):
"text" must be: EXACTLY as in input. No rewording, truncation, or correction.
You may: remove obvious headers/footers (e.g., page numbers), normalize spacing. But wording must remain unchanged.

3. Provision Classification:
Determine "provision_type" using STRICT rules:
"requirement" → contains "shall"
"recommendation" → contains "should"
"permission" → contains "may"
"definition" → defines a term explicitly
"guidance" → explanatory text without obligation
If unclear → "unknown"

4. Topic Tagging (max 5):
Assign up to 5 relevant topics based ONLY on explicit content.
Examples: "ATS", "Separation", "GNSS", "Surveillance", "CPDLC", "Communication", "Navigation", "Aerodrome", "Safety", "Airspace".
Do NOT invent niche or speculative tags.

5. Domain Classification:
Set "domain" to one of: "CNS", "ATM", "OPS", "AERODROME", "GENERAL"

6. Regulatory Strength Flag:
Set "regulatory_strength":
"mandatory" → if "shall"
"recommended" → if "should"
"optional" → if "may"
"informational" → otherwise

VALIDATION (MANDATORY SELF-CHECK)
The "text" is unchanged in meaning and wording.
No hallucinated structure fields.
JSON is valid.
Topics are relevant and ≤ 5.
If uncertain → leave fields empty or "unknown".

FAIL-SAFE BEHAVIOR
If the input is too fragmented, unclear, or missing structure: still extract "text" exactly, set other fields to empty or "unknown". DO NOT guess.

PROCESSING RULES
Process ONE input block at a time.
Output ONE JSON object per input.
No explanations, no commentary.
Output ONLY JSON.`;

const GEMINI_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    document: { type: Type.STRING },
    chapter: { type: Type.STRING },
    section: { type: Type.STRING },
    subsection: { type: Type.STRING },
    heading: { type: Type.STRING },
    text: { type: Type.STRING },
    provision_type: { 
      type: Type.STRING,
      enum: ["requirement", "recommendation", "permission", "definition", "guidance", "unknown"]
    },
    regulatory_strength: { 
      type: Type.STRING,
      enum: ["mandatory", "recommended", "optional", "informational"]
    },
    domain: { 
      type: Type.STRING, 
      enum: ["CNS", "ATM", "OPS", "AERODROME", "GENERAL"] 
    },
    topics: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING } 
    },
    confidence: { 
      type: Type.STRING,
      enum: ["high", "medium", "low"]
    }
  },
  required: ["document", "chapter", "section", "subsection", "heading", "text", "provision_type", "regulatory_strength", "domain", "topics", "confidence"]
};

export const getLocalModels = async (baseUrl: string): Promise<string[]> => {
  const url = `${baseUrl.replace(/\/$/, "")}/models`;
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) return [];
    const json = await response.json();
    
    // LM Studio format: { models: [ { type: 'llm', loaded_instances: [{ id: '...' }] } ] }
    if (json.models) {
      return json.models
        .filter((m: any) => m.type === "llm" && m.loaded_instances?.length > 0)
        .map((m: any) => m.loaded_instances[0].id);
    }
    
    // OpenAI/Standard format: { data: [{ id: '...' }] }
    if (json.data) {
      return json.data.map((m: any) => m.id);
    }

    return [];
  } catch (error) {
    if (error instanceof TypeError && (error.message === "Failed to fetch" || error.message.includes("NetworkError"))) {
      console.warn("Connection Blocked: This is likely a CORS or HTTPS/HTTP Mixed Content issue.");
    }
    return [];
  }
};

export interface ConnectionTestResult {
  success: boolean;
  url: string;
  data?: any;
  error?: string;
}

export const testLocalConnection = async (settings: AppSettings): Promise<ConnectionTestResult> => {
  const url = `${settings.localBaseUrl.replace(/\/$/, "")}/models`;
  
  try {
    const response = await fetch(url, { mode: "cors" });
    const json = await response.json();
    
    if (!response.ok) {
      return { success: false, url, error: `HTTP ${response.status}`, data: json };
    }

    return { success: true, url, data: json };
  } catch (error) {
    return { 
      success: false, 
      url,
      error: error instanceof Error ? error.message : "Unknown error",
      data: null 
    };
  }
};

export const processAviationText = async (text: string, settings: AppSettings): Promise<ProcessedProvision> => {
  if (settings.provider === 'gemini') {
    return processWithGemini(text);
  } else {
    return processWithLocalLLM(text, settings);
  }
};

const processWithGemini = async (text: string): Promise<ProcessedProvision> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }
  const ai = new GoogleGenAI({ apiKey });
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: "user", parts: [{ text }] }],
    systemInstruction: SYSTEM_PROMPT,
    responseMimeType: "application/json",
    responseSchema: GEMINI_SCHEMA
  } as any);

  const resultText = response.text;
  if (!resultText) {
    throw new Error("No response from Gemini");
  }

  return JSON.parse(resultText) as ProcessedProvision;
};

const processWithLocalLLM = async (text: string, settings: AppSettings): Promise<ProcessedProvision> => {
  const url = `${settings.localBaseUrl.replace(/\/$/, "")}/chat`;
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      mode: "cors",
      body: JSON.stringify({
        model: settings.localModelName,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      let errorBody = "";
      try {
        errorBody = await response.text();
      } catch (e) {
        errorBody = "Could not read error response body";
      }
      throw new Error(`Local LLM Error [${response.status}]: ${errorBody || response.statusText}`);
    }

    const json = await response.json();
    if (!json.choices?.[0]?.message?.content) {
      throw new Error(`Unexpected Response Format: ${JSON.stringify(json)}`);
    }
    const content = json.choices[0].message.content;
    return JSON.parse(content) as ProcessedProvision;
  } catch (error) {
    if (error instanceof TypeError && (error.message === "Failed to fetch" || error.message.includes("NetworkError"))) {
      throw new Error("Network Error: Connection refused or blocked by CORS. Please check browser 'Insecure Content' settings and LM Studio CORS config.");
    }
    if (error instanceof SyntaxError) {
      throw new Error(`JSON Parse Error: The LLM returned invalid JSON. Error: ${error.message}`);
    }
    throw error;
  }
};
