
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const generateFolderInsights = async (folderName: string, imageCount: number, videoCount: number) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a short professional summary for a presentation folder named "${folderName}" which contains ${imageCount} supporting images and ${videoCount} videos. Focus on how this content could be presented to a client as a cohesive project. Keep it under 60 words.`,
      config: {
        temperature: 0.7,
      }
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Error generating AI insights. Please check your connectivity.";
  }
};
