import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

const FORCE_MOCK_IMAGE_VERIFICATION = false;

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
  authenticityConfidence: number;
  authenticityExplanation: string;
  confidence: number;
  coveragePercentage: number;
  densityScore: number;
  detected: boolean;
  explanation: string;
  isRealImage: boolean;
  imageSubject: string;
  category: "garbage" | "pothole" | "water_leakage" | "other";
  priority: "high" | "medium" | "low";
  aiDescription: string;
  locationVerified: boolean;
}

interface GeminiIssueAssessment {
  isRealImage: boolean;
  imageSubject: string;
  detected: boolean;
  authenticityConfidence: number;
  authenticityExplanation: string;
  confidence: number;
  coveragePercentage: number;
  densityScore: number;
  explanation: string;
  containsScreenOrDevice: boolean;
  category: VerificationResult["category"];
  priority: VerificationResult["priority"];
  summary: string;
}

let cachedClient: GoogleGenAI | null = null;

export interface ImageClassificationResult {
  category: VerificationResult["category"];
  priority: VerificationResult["priority"];
  confidence: number;
  description: string;
}

const ANALYSIS_CACHE_TTL_MS = 5 * 60 * 1000;
const geminiAnalysisCache = new Map<string, { assessment: GeminiIssueAssessment; expiresAt: number }>();

function emitGeminiDebug(level: "info" | "warn" | "error", message: string, payload: Record<string, unknown>) {
  logger[level](payload, message);

  const formatted = `[GeminiDebug] ${message} ${JSON.stringify(payload)}`;
  if (level === "error") {
    console.error(formatted);
    return;
  }

  if (level === "warn") {
    console.warn(formatted);
    return;
  }

  console.log(formatted);
}

function extractGeminiResponseMeta(response: unknown) {
  const value = response as {
    usageMetadata?: unknown;
    candidates?: unknown;
    promptFeedback?: unknown;
    responseId?: unknown;
    modelVersion?: unknown;
    createTime?: unknown;
  };

  return {
    responseId: value?.responseId ?? null,
    modelVersion: value?.modelVersion ?? null,
    createTime: value?.createTime ?? null,
    usageMetadata: value?.usageMetadata ?? null,
    promptFeedback: value?.promptFeedback ?? null,
    candidates: Array.isArray(value?.candidates)
      ? value.candidates.map((candidate) => {
          const item = candidate as {
            finishReason?: unknown;
            avgLogprobs?: unknown;
            index?: unknown;
            safetyRatings?: unknown;
            content?: unknown;
            tokenCount?: unknown;
          };

          return {
            index: item?.index ?? null,
            finishReason: item?.finishReason ?? null,
            avgLogprobs: item?.avgLogprobs ?? null,
            tokenCount: item?.tokenCount ?? null,
            safetyRatings: item?.safetyRatings ?? null,
            content: item?.content ?? null,
          };
        })
      : null,
  };
}

function getMockVerificationResult(): GeminiIssueAssessment {
  return {
    isRealImage: true,
    imageSubject: "roadside garbage pile",
    detected: true,
    authenticityConfidence: 0.99,
    authenticityExplanation: "Mock verification enabled. Image treated as a real camera image.",
    confidence: 0.99,
    coveragePercentage: 72,
    densityScore: 0.86,
    explanation: "Mock verification enabled. Garbage issue detected.",
    containsScreenOrDevice: false,
    category: "garbage",
    priority: "medium",
    summary: "Mock verification enabled. Image accepted without Gemini.",
  };
}

function getCachedAssessment(imageUrl: string) {
  const cached = geminiAnalysisCache.get(imageUrl);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt < Date.now()) {
    geminiAnalysisCache.delete(imageUrl);
    return null;
  }

  return cached.assessment;
}

function setCachedAssessment(imageUrl: string, assessment: GeminiIssueAssessment) {
  geminiAnalysisCache.set(imageUrl, {
    assessment,
    expiresAt: Date.now() + ANALYSIS_CACHE_TTL_MS,
  });
}

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
  const cachedAssessment = getCachedAssessment(imageUrl);
  if (cachedAssessment) {
    emitGeminiDebug("info", "Using cached Gemini image analysis", {
      imageUrl,
      cachedAssessment,
    });
    return cachedAssessment;
  }

  if (FORCE_MOCK_IMAGE_VERIFICATION) {
    const mockResult = getMockVerificationResult();
    emitGeminiDebug("warn", "Gemini mock mode enabled", {
      imageUrl,
      mockResult,
    });
    setCachedAssessment(imageUrl, mockResult);
    return mockResult;
  }

  const client = getGeminiClient();
  const imageData = getLocalImageData(imageUrl);

  if (!client || !imageData) {
    emitGeminiDebug("warn", "Skipping Gemini image analysis", {
      imageUrl,
      hasGeminiClient: Boolean(client),
      hasImageData: Boolean(imageData),
    });
    return null;
  }

  const prompt = `
Return strict JSON with these keys:
{
  "isRealImage": boolean,
  "imageSubject": string,
  "detected": boolean,
  "authenticityConfidence": number,
  "authenticityExplanation": string,
  "confidence": number,
  "coveragePercentage": number,
  "densityScore": number,
  "explanation": string,
  "containsScreenOrDevice": boolean,
  "category": "garbage" | "pothole" | "water_leakage" | "other",
  "priority": "high" | "medium" | "low",
  "summary": string
}

Determine whether this image is:
1. a real, non-AI, non-manipulated camera photo
2. clearly showing a genuine public civic issue

Reject screenshots, laptop or phone screens, televisions, documents, selfies, indoor personal objects, pets, and unrelated scenes.
Treat visible roadside trash, litter, garbage bags, waste piles, overflowing bins, dumped debris, drains, potholes, leakage, and damaged public infrastructure as real civic issues when they are clearly visible in the scene.
If the photo is a real outdoor garbage image, mark category as "garbage" even when the garbage pile is small or spread out.
Also classify the civic issue category and priority.
`;

  const response = await client.models.generateContent({
    model: "gemini-3.1-flash-lite-preview",
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
  console.log("Gemini raw response:", response);
  emitGeminiDebug("info", "Gemini full response metadata", {
    imageUrl,
    responseMeta: extractGeminiResponseMeta(response),
  });
  emitGeminiDebug("info", "Gemini raw image analysis response", {
    imageUrl,
    rawResponse: text,
  });

  if (!text) {
    emitGeminiDebug("warn", "Gemini returned an empty image analysis response", { imageUrl });
    return null;
  }

  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) {
    emitGeminiDebug("warn", "Gemini response did not contain JSON", {
      imageUrl,
      rawResponse: text,
    });
    return null;
  }

  const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as GeminiIssueAssessment;
  setCachedAssessment(imageUrl, parsed);
  emitGeminiDebug("info", "Gemini parsed image analysis response", {
    imageUrl,
    parsedResponse: parsed,
  });

  return parsed;
}

function buildClassificationDescription(result: GeminiIssueAssessment): string {
  if (result.explanation?.trim()) {
    return result.explanation.trim();
  }

  if (result.summary?.trim()) {
    return result.summary.trim();
  }

  switch (result.category) {
    case "garbage":
      return "Garbage or waste detected in the uploaded image.";
    case "pothole":
      return "Road damage or pothole detected in the uploaded image.";
    case "water_leakage":
      return "Water leakage or drain issue detected in the uploaded image.";
    default:
      return "Civic issue detected in the uploaded image.";
  }
}

function buildImageRejectionSummary(result: GeminiIssueAssessment): string {
  if (!result.isRealImage || result.containsScreenOrDevice) {
    return `Fake image detected. The image appears to show ${result.imageSubject || "a non-real or screen-based scene"}.`;
  }

  if (!result.detected || result.category === "other") {
    return `Issue not detected. The image appears to show ${result.imageSubject || "something unrelated"}.`;
  }

  return "Image verification failed. Upload a clearer live photo of the garbage or civic issue.";
}

function buildRejectedResult(
  summary: string,
  overrides?: Partial<
    Pick<
      VerificationResult,
      | "authenticityScore"
      | "confidenceScore"
      | "authenticityConfidence"
      | "authenticityExplanation"
      | "confidence"
      | "coveragePercentage"
      | "densityScore"
      | "detected"
      | "explanation"
      | "isRealImage"
      | "imageSubject"
      | "category"
      | "priority"
      | "aiDescription"
    >
  >,
): VerificationResult {
  return {
    accepted: false,
    verificationStatus: "rejected",
    verificationSummary: summary,
    authenticityScore: overrides?.authenticityScore ?? 0,
    confidenceScore: overrides?.confidenceScore ?? 0,
    authenticityConfidence: overrides?.authenticityConfidence ?? 0,
    authenticityExplanation: overrides?.authenticityExplanation ?? summary,
    confidence: overrides?.confidence ?? 0,
    coveragePercentage: overrides?.coveragePercentage ?? 0,
    densityScore: ( overrides?.densityScore ?? 0 ) * 100,
    detected: overrides?.detected ?? false,
    explanation: overrides?.explanation ?? summary,
    isRealImage: overrides?.isRealImage ?? false,
    imageSubject: overrides?.imageSubject ?? "",
    category: overrides?.category ?? "other",
    priority: overrides?.priority ?? "low",
    aiDescription: overrides?.aiDescription ?? summary,
    locationVerified: false,
  };
}

export async function precheckIssueImage(input: Pick<VerificationInput, "imageUrl" | "imageSource">): Promise<VerificationResult> {
  const geminiResult = await analyzeWithGemini(input.imageUrl).catch(() => null);
  if (!geminiResult) {
    return buildRejectedResult(
      "Invalid image. AI verification could not confirm this as a real civic issue photo.",
    );
  }

  const acceptedImage =
    geminiResult.isRealImage &&
    geminiResult.detected &&
    !geminiResult.containsScreenOrDevice &&
    geminiResult.authenticityConfidence >= 0.72 &&
    geminiResult.confidence >= 0.58;

  emitGeminiDebug("info", "Issue image verification decision", {
    imageUrl: input.imageUrl,
    imageSource: input.imageSource,
    acceptedImage,
    thresholds: {
      minAuthenticityConfidence: 0.72,
      minConfidence: 0.58,
    },
    geminiResult,
  });

  if (!acceptedImage) {
    return buildRejectedResult(
      buildImageRejectionSummary(geminiResult),
      {
        authenticityScore: geminiResult.authenticityConfidence,
        confidenceScore: geminiResult.confidence,
        authenticityConfidence: geminiResult.authenticityConfidence,
        authenticityExplanation: geminiResult.authenticityExplanation,
        confidence: geminiResult.confidence,
        coveragePercentage: geminiResult.coveragePercentage,
        densityScore: (geminiResult.densityScore) * 100,
        detected: geminiResult.detected,
        explanation: geminiResult.explanation,
        isRealImage: geminiResult.isRealImage,
        imageSubject: geminiResult.imageSubject,
        category: geminiResult.category,
        priority: geminiResult.priority,
        aiDescription: geminiResult.explanation || geminiResult.summary,
      },
    );
  }

  return {
    accepted: true,
    verificationStatus: "verified",
    verificationSummary:
      geminiResult.category === "garbage"
        ? "Real garbage image detected and verified."
        : "Real civic issue image detected and verified.",
    authenticityScore: geminiResult.authenticityConfidence,
    confidenceScore: geminiResult.confidence,
    authenticityConfidence: geminiResult.authenticityConfidence,
    authenticityExplanation: geminiResult.authenticityExplanation,
    confidence: geminiResult.confidence,
    coveragePercentage: geminiResult.coveragePercentage,
    densityScore: (geminiResult.densityScore) * 100,
    detected: geminiResult.detected,
    explanation: geminiResult.explanation,
    isRealImage: geminiResult.isRealImage,
    imageSubject: geminiResult.imageSubject,
    category: geminiResult.category,
    priority: geminiResult.priority,
    aiDescription: geminiResult.explanation || geminiResult.summary,
    locationVerified: false,
  };
}

export async function classifyIssueImage(imageUrl: string): Promise<ImageClassificationResult> {
  const geminiResult = await analyzeWithGemini(imageUrl).catch(() => null);

  if (!geminiResult) {
    emitGeminiDebug("warn", "Gemini image classification failed", { imageUrl });
    return {
      category: "other",
      priority: "low",
      confidence: 0.5,
      description: "Could not confidently classify the uploaded image.",
    };
  }

  const result = {
    category: geminiResult.category,
    priority: geminiResult.priority,
    confidence: geminiResult.confidence,
    description: buildClassificationDescription(geminiResult),
  };

  emitGeminiDebug("info", "Issue image classification result", {
    imageUrl,
    classification: result,
    geminiResult,
  });

  return result;
}

export async function verifyIssueSubmission(
  input: VerificationInput,
): Promise<VerificationResult> {
  if (FORCE_MOCK_IMAGE_VERIFICATION) {
    const imageVerification = await precheckIssueImage({
      imageUrl: input.imageUrl,
      imageSource: input.imageSource,
    });

    return {
      ...imageVerification,
      accepted: true,
      verificationStatus: "verified",
      verificationSummary: "Mock verification enabled. Issue accepted without Gemini or location checks.",
      locationVerified: true,
    };
  }

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

  const galleryUploadAccepted = input.imageSource === "gallery" && imageVerification.accepted;
  const accepted = imageVerification.accepted && (locationVerified || galleryUploadAccepted);

  return {
    ...imageVerification,
    accepted,
    verificationStatus: accepted ? "verified" : "rejected",
    verificationSummary: accepted
      ? input.imageSource === "gallery"
        ? "Image checks passed for gallery upload."
        : "Image and location checks passed."
      : "Location verification failed. Capture the image at the issue location and try again.",
    locationVerified: locationVerified || galleryUploadAccepted,
  };
}

export async function verifyWorkerReportImage(imageUrl: string | null) {
  if (!imageUrl) {
    return {
      status: "verified" as const,
      summary: "No image attached for daily report.",
    };
  }

  if (FORCE_MOCK_IMAGE_VERIFICATION) {
    emitGeminiDebug("warn", "Worker image accepted in mock mode", { imageUrl });
    return {
      status: "verified" as const,
      summary: "Mock verification enabled. Worker report image accepted.",
    };
  }

  const geminiResult = await analyzeWithGemini(imageUrl).catch(() => null);
  if (!geminiResult) {
    return {
      status: "rejected" as const,
      summary: "Worker proof image could not be verified.",
    };
  }

  const acceptedImage =
    geminiResult.isRealImage &&
    geminiResult.detected &&
    !geminiResult.containsScreenOrDevice &&
    geminiResult.authenticityConfidence >= 0.8 &&
    geminiResult.confidence >= 0.7;

  return {
    status: acceptedImage ? ("verified" as const) : ("rejected" as const),
    summary:
      acceptedImage
        ? "Worker report image passed verification."
        : "Worker report image looks invalid, manipulated, or unrelated to field work.",
  };
}
