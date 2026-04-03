import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env.js";

export interface VerificationInput {
  imageUrl: string;
  reportLatitude: number;
  reportLongitude: number;
  captureLatitude?: number | null;
  captureLongitude?: number | null;
  imageSource: "camera" | "gallery";
}

export interface VerificationResult {
  accepted: boolean;
  verificationStatus: "verified" | "rejected";
  verificationSummary: string;
  authenticityScore: number;
  confidenceScore: number;
  category: "garbage" | "pothole" | "water_leakage" | "other";
  priority: "high" | "medium" | "low";
  aiDescription: string;
  locationVerified: boolean;
}

interface GeminiIssueAssessment {
  isAuthentic: boolean;
  isPublicCivicIssue: boolean;
  containsScreenOrDevice: boolean;
  authenticityScore: number;
  civicRelevanceScore: number;
  category: VerificationResult["category"];
  priority: VerificationResult["priority"];
  confidenceScore: number;
  summary: string;
}

let cachedClient: GoogleGenAI | null = null;

function getGeminiClient() {
  if (!env.geminiApiKey) {
    return null;
  }

  if (!cachedClient) {
    cachedClient = new GoogleGenAI({ apiKey: env.geminiApiKey });
  }

  return cachedClient;
}

function distanceInKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
}

function getLocalImageData(imageUrl: string) {
  const uploadMarker = "/api/uploads/";
  const markerIndex = imageUrl.indexOf(uploadMarker);
  if (markerIndex === -1) {
    return null;
  }

  const fileName = imageUrl.slice(markerIndex + uploadMarker.length);
  const resolvedPath = path.resolve(env.uploadDir, fileName);
  if (!fs.existsSync(resolvedPath)) {
    return null;
  }

  const extension = path.extname(resolvedPath).toLowerCase();
  const mimeType =
    extension === ".png"
      ? "image/png"
      : extension === ".webp"
        ? "image/webp"
        : "image/jpeg";

  return {
    mimeType,
    data: fs.readFileSync(resolvedPath).toString("base64"),
  };
}

async function analyzeWithGemini(imageUrl: string) {
  const client = getGeminiClient();
  const imageData = getLocalImageData(imageUrl);

  if (!client || !imageData) {
    return null;
  }

  const prompt = `
Return strict JSON with these keys:
{
  "isAuthentic": boolean,
  "isPublicCivicIssue": boolean,
  "containsScreenOrDevice": boolean,
  "authenticityScore": number,
  "civicRelevanceScore": number,
  "category": "garbage" | "pothole" | "water_leakage" | "other",
  "priority": "high" | "medium" | "low",
  "confidenceScore": number,
  "summary": string
}

Determine whether this image is:
1. a real, non-AI, non-manipulated camera photo
2. clearly showing a genuine public civic issue

Reject screenshots, laptop or phone screens, televisions, documents, selfies, indoor personal objects, pets, and unrelated scenes.
Only mark isPublicCivicIssue true when the image clearly shows a real civic problem such as garbage, potholes, road damage, drains, leakage, or damaged public infrastructure.
Also classify the civic issue category and priority.
`;

  const response = await client.models.generateContent({
    model: "gemini-2.0-flash-001",
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: imageData.mimeType,
              data: imageData.data,
            },
          },
        ],
      },
    ],
  });

  const text = response.text?.trim() || "";
  if (!text) {
    return null;
  }

  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) {
    return null;
  }

  return JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as GeminiIssueAssessment;
}

function buildRejectedResult(
  summary: string,
  overrides?: Partial<Pick<VerificationResult, "authenticityScore" | "confidenceScore" | "category" | "priority" | "aiDescription">>,
): VerificationResult {
  return {
    accepted: false,
    verificationStatus: "rejected",
    verificationSummary: summary,
    authenticityScore: overrides?.authenticityScore ?? 0,
    confidenceScore: overrides?.confidenceScore ?? 0,
    category: overrides?.category ?? "other",
    priority: overrides?.priority ?? "low",
    aiDescription: overrides?.aiDescription ?? summary,
    locationVerified: false,
  };
}

export async function precheckIssueImage(input: Pick<VerificationInput, "imageUrl" | "imageSource">): Promise<VerificationResult> {
  if (input.imageSource !== "camera") {
    return buildRejectedResult("Invalid image. Only fresh camera photos are allowed.");
  }

  const geminiResult = await analyzeWithGemini(input.imageUrl).catch(() => null);
  if (!geminiResult) {
    return buildRejectedResult(
      "Invalid image. AI verification could not confirm this as a real civic issue photo.",
    );
  }

  const acceptedImage =
    geminiResult.isAuthentic &&
    geminiResult.isPublicCivicIssue &&
    !geminiResult.containsScreenOrDevice &&
    geminiResult.authenticityScore >= 0.88 &&
    geminiResult.civicRelevanceScore >= 0.72 &&
    geminiResult.confidenceScore >= 0.75;

  if (!acceptedImage) {
    return buildRejectedResult(
      "Invalid image. Capture a clear live photo of the civic issue. Screens, laptops, and unrelated objects are rejected.",
      {
        authenticityScore: geminiResult.authenticityScore,
        confidenceScore: geminiResult.confidenceScore,
        category: geminiResult.category,
        priority: geminiResult.priority,
        aiDescription: geminiResult.summary,
      },
    );
  }

  return {
    accepted: true,
    verificationStatus: "verified",
    verificationSummary: "Image authenticity and civic relevance checks passed.",
    authenticityScore: geminiResult.authenticityScore,
    confidenceScore: geminiResult.confidenceScore,
    category: geminiResult.category,
    priority: geminiResult.priority,
    aiDescription: geminiResult.summary,
    locationVerified: false,
  };
}

export async function verifyIssueSubmission(
  input: VerificationInput,
): Promise<VerificationResult> {
  const imageVerification = await precheckIssueImage({
    imageUrl: input.imageUrl,
    imageSource: input.imageSource,
  });

  if (!imageVerification.accepted) {
    return imageVerification;
  }

  const locationVerified =
    typeof input.captureLatitude === "number" &&
    typeof input.captureLongitude === "number" &&
    distanceInKm(
      input.reportLatitude,
      input.reportLongitude,
      input.captureLatitude,
      input.captureLongitude,
    ) <= 0.75;

  const accepted = imageVerification.accepted && locationVerified;

  return {
    accepted,
    verificationStatus: accepted ? "verified" : "rejected",
    verificationSummary: accepted
      ? "Image and location checks passed."
      : "Location verification failed. Capture the image at the issue location and try again.",
    authenticityScore: imageVerification.authenticityScore,
    confidenceScore: imageVerification.confidenceScore,
    category: imageVerification.category,
    priority: imageVerification.priority,
    aiDescription: imageVerification.aiDescription,
    locationVerified,
  };
}

export async function verifyWorkerReportImage(imageUrl: string | null) {
  if (!imageUrl) {
    return {
      status: "verified" as const,
      summary: "No image attached for daily report.",
    };
  }

  const geminiResult = await analyzeWithGemini(imageUrl).catch(() => null);
  if (!geminiResult) {
    return {
      status: "rejected" as const,
      summary: "Worker proof image could not be verified.",
    };
  }

  const authenticityScore = geminiResult.authenticityScore;
  const acceptedImage =
    geminiResult.isAuthentic &&
    !geminiResult.containsScreenOrDevice &&
    authenticityScore >= 0.8 &&
    geminiResult.confidenceScore >= 0.7;

  return {
    status: acceptedImage ? ("verified" as const) : ("rejected" as const),
    summary:
      acceptedImage
        ? "Worker report image passed verification."
        : "Worker report image looks invalid, manipulated, or unrelated to field work.",
  };
}
