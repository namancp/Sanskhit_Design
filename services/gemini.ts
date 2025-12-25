
import { GoogleGenAI } from "@google/genai";
import { AspectRatio } from "../types";

export const generatePosterBackground = async (
  prompt: string,
  aspectRatio: AspectRatio
): Promise<string> => {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey) {
    console.warn("API_KEY is missing. Background generation will fail.");
    throw new Error("Missing API_KEY. Please set your Gemini API key.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: `High-quality cinematic background for a professional event poster. 
            Scene: ${prompt}. 
            Vibe: Ultra-modern, Dubai luxury, technology-centric. 
            Composition: Ensure the lower 40% and top 20% of the image has relative negative space (dark or soft focus) to allow for white text and logos to be clearly visible. 
            Do not include any pre-written text in the image. 
            Use professional architectural lighting.`
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio as any,
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    
    throw new Error("Empty model response");
  } catch (error) {
    console.error("Gemini Image Gen Error:", error);
    throw error;
  }
};
