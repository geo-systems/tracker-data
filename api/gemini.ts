import "dotenv/config";

import { GoogleGenAI, Type } from "@google/genai";
import { randomUUID } from "crypto";

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  details: string;
  sourceName: string;
  sourceUrl: string;
  ts: number;
  bullOrbearForCryptoInvestor: "bullish" | "bearish" | "neutral";
}

export interface NewsBullet {
  id: string;
  shortBulletSummary: string;
  ts: number;
  bullOrbearForCryptoInvestor: "bullish" | "bearish" | "neutral";
}

const tryWithModels = async <T>(
  models: string[],
  fn: (model: string) => Promise<T>,
) => {
  for (const model of models) {
    try {
      return await fn(model);
    } catch (error) {
      console.error(`Error with model ${model}:`, error);
    }
  }
  throw new Error(`All models failed: ${models.join(", ")}`);
};

const getSupportedModelsFromAi = async (ai: GoogleGenAI): Promise<string[]> => {
  const supportedModelsRaw = await ai.models.list();
  const supportedModels = supportedModelsRaw.page.map((model) =>
    model.name!.replace("models/", ""),
  );
  console.log("Supported models:", supportedModels.join(", "));
  return supportedModels;
};

const setItemsSystemProps = (newsItems: NewsItem[] | NewsBullet[]) => {
  const now = Date.now();
  newsItems.forEach((item) => {
    if (!item.id) {
      item.id = randomUUID();
    }
    item.ts = now;
  });
}

interface FetchNewsOptions {
  prompt: string;
  sources: string;
}

export const fetchNewsGeneric = async <T>(
  fullPrompt: string,
  responseSchema: object,
): Promise<T> => {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set in environment variables");
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const supportedModels = await getSupportedModelsFromAi(ai);
  const getSupportedModels = (models: string[]) =>
    models.filter((model) => supportedModels.includes(model));
  
  // First Gemini call to get raw text response with Google Search
  const rawResponse = await tryWithModels(
    getSupportedModels([
      "gemini-flash-latest",
      "gemini-2.5-flash",
      "gemini-2.0-flash",
    ]),
    async (model) => {
      const result = await ai.models.generateContent({
        model,
        contents: fullPrompt,
        config: {
          tools: [{ googleSearch: {} }],
          temperature: 1.0,
        },
      });
      console.log(
        `Raw response from Gemini using model ${model}:`,
        result.text,
      );
      return result;
    },
  );

  const jsonResult = await tryWithModels(
    getSupportedModels([
      "gemini-flash-latest",
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-flash-lite-latest",
      "gemini-2.5-flash-lite",
      "gemini-2.0-flash-lite",
    ]),
    async (model) => {
      const result = await ai.models.generateContent({
        model,
        contents: `
          Convert the following news text into JSON array format according to the provided schema. 
          For each news, item ensure there is a matching element in the JSON array. The news text may contain multiple news items, so ensure to capture all of them in the JSON output.
          News Text: ${rawResponse.text}`,
        config: {
          responseMimeType: "application/json",
          responseSchema,
        },
      });
      const parsedResult = JSON.parse(result.text!);
      console.log(
        `JSON response from Gemini using model ${model}:`,
        JSON.stringify(parsedResult, null, 2),
      );
      return parsedResult;
    },
  );

  return jsonResult as T;
};

export const fetchNews = async (newsOp: FetchNewsOptions) => {
  const { prompt, sources } = newsOp;
  const fullPrompt = `
            ${prompt}
            Requirements:
            - Preferably from the last 24 hours and from ${sources}. 
            - Include title, details, source name, and source URL.
            - Keep the title short (ideally under 100 characters) and the details concise (ideally under 500 characters).
            - VERY IMPORTANT: The source URL should be valid (for credibility and for users to verify the news).
            - For source URL, ensure it is a direct link to the news article, not a homepage or search results page.
            - Avoid sources that require a subscription, paywall, or login.
            - The source name should be a single reputable source, even when multiple sources report on the same news item.
            - Avoid clickbait or sensationalist sources.
            - Deduplicate news from multiple sources and prioritize the most reputable source for each news item.
            - For each news item, include a sentiment analysis for crypto investors - one of "bullish", "bearish", or "neutral" for cryptocurrency markets.
            - Target audience is crypto investors, so prioritize news that is relevant for them.
            - Avoid news that is unrelated to financial markets or cryptocurrencies or cannot impact them.
        `;

  const responseSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        details: { type: Type.STRING },
        sourceName: { type: Type.STRING },
        sourceUrl: { type: Type.STRING },
        bullOrbearForCryptoInvestor: {
          type: Type.STRING,
          enum: ["bullish", "bearish", "neutral"],
        },
      },
    },
  };

  const newsItems = await fetchNewsGeneric<NewsItem[]>(
    fullPrompt,
    responseSchema,
  );
  setItemsSystemProps(newsItems);
  return newsItems;
};


export const fetchNewsBullets = async () => {
  const fullPrompt = `
            Summarize major news on cryptocurrencies, crypto markets, crypto sentiment, and major macro and geopolitical events that can impact crypto markets in 2-5 separate summary items.
            Requirements:
            - Each summary item should be short (ideally under 75 characters).
            - Preferably from the last 24 hours and from reputable crypto or financial media sources. 
            - Very popular social media accounts (e.g. on X/Twitter) can be considered as a source if they are known for providing high-quality, accurate, and timely information on crypto and macro markets.
            - For each news item, include a sentiment analysis for crypto investors - one of "bullish", "bearish", or "neutral" for cryptocurrency markets.
            - Avoid clickbait or sensationalist sources.
            - Target audience is crypto investors, so prioritize news that is relevant for them.
            - Avoid news that is unrelated to financial markets or cryptocurrencies or cannot impact them.
        `;

  const responseSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        shortBulletSummary: { type: Type.STRING },
        bullOrbearForCryptoInvestor: {
          type: Type.STRING,
          enum: ["bullish", "bearish", "neutral"],
        },
      },
    },
  };

  const newsItems = await fetchNewsGeneric<NewsBullet[]>(
    fullPrompt,
    responseSchema,
  );
  setItemsSystemProps(newsItems);
  return newsItems;
};
