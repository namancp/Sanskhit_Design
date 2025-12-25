
import { GoogleGenAI } from "@google/genai";
import { AspectRatio } from "../types";

export const generatePosterBackground = async (
  prompt: string,
  aspectRatio: AspectRatio
): Promise<string> => {
  // Use direct process.env.API_KEY as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
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
    console.error("Gemini NanoBanana Error:", error);
    throw error;
  }
};
