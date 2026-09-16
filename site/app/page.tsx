"use client";

import {
  Check,
  Copy,
  Cpu,
  Download,
  FileImage,
  FileText,
  LoaderCircle,
  Play,
  RotateCcw,
  ScanLine,
  ServerOff,
  Upload,
} from "lucide-react";
import { DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { sampleFullText, sampleMeta, sampleRegions } from "@/lib/sample-data";

type ModelState = "connecting" | "online" | "offline";
type ProcessState = "idle" | "uploading" | "analyzing" | "recognizing" | "success" | "error";

type HealthResponse = {
  status: string;
  checkpointStep: number;
  warmedUp?: boolean;
  model?: { base?: string; checkpointStep?: number };
};

type RuntimeConfig = {
  apiBaseUrl: string;
  checkpointStep: number;
  updatedAt: string | null;
};

type OcrResponse = {
  requestId: string;
  text: string;
  processingMs: number;
  imageWidth: number;
  imageHeight: number;
  model: { base: string; checkpointStep: number };
  layoutMode: "text_only";
};

type ModelContext = {
  registerTool: (
    tool: {
      name: string;
      title: string;
      description: string;
      inputSchema: Record<string, unknown>;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: () => Promise<Record<string, unknown>>;
    },
    options?: { signal?: AbortSignal },
  ) => void | Promise<void>;
};

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const DEFAULT_API_URL = process.env.NEXT_PUBLIC_OCR_API_URL ?? "";
const SAMPLE_IMAGE_URL = `${BASE_PATH}/dunhuang-sample.jpg`;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

function processLabel(state: ProcessState) {
  if (state === "uploading") return "Uploading image";
  if (state === "analyzing") return "Analyzing document";
  if (state === "recognizing") return "Recognizing text";
  return "";
}

function processProgress(state: ProcessState) {
  if (state === "uploading") return 18;
  if (state === "analyzing") return 48;
  if (state === "recognizing") return 78;
  if (state === "success") return 100;
  return 0;
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const resultItemsRef = useRef<Record<string, HTMLButtonElement | null>>({});
  const objectUrlRef = useRef<string | null>(null);
  const [modelState, setModelState] = useState<ModelState>("connecting");
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL.replace(/\/$/, ""));
  const [modelBase, setModelBase] = useState("GLM-OCR-ca5d8b3");
  const [processState, setProcessState] = useState<ProcessState>("success");
  const [isSample, setIsSample] = useState(true);
  const [imageUrl, setImageUrl] = useState(SAMPLE_IMAGE_URL);
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState(sampleMeta.filename);
  const [fileSize, setFileSize] = useState(sampleMeta.sizeLabel);
  const [dimensions, setDimensions] = useState({ width: sampleMeta.width, height: sampleMeta.height });
  const [text, setText] = useState(sampleFullText);
  const [processingMs, setProcessingMs] = useState(sampleMeta.processingMs);
  const [activeRegion, setActiveRegion] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [dragging, setDragging] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  const isProcessing = ["uploading", "analyzing", "recognizing"].includes(processState);
  const characterCount = useMemo(() => text.replace(/\s/g, "").length, [text]);

  useEffect(() => {
    let cancelled = false;
    const loadRuntimeConfig = async () => {
      try {
        const response = await fetch(`${BASE_PATH}/runtime-config.json?t=${Date.now()}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) throw new Error("Runtime configuration is unavailable");
        const config = (await response.json()) as RuntimeConfig;
        if (config.checkpointStep !== 3500) throw new Error("Unexpected checkpoint configuration");
        const configuredUrl = config.apiBaseUrl.trim().replace(/\/$/, "");
        if (!cancelled && configuredUrl) setApiUrl(configuredUrl);
        if (!cancelled && !configuredUrl && !DEFAULT_API_URL) setModelState("offline");
      } catch {
        if (!cancelled && !DEFAULT_API_URL) {
          setApiUrl("");
          setModelState("offline");
        }
      }
    };
    void loadRuntimeConfig();
    return () => { cancelled = true; };
  }, []);

  const checkHealth = useCallback(async () => {
    if (!apiUrl) {
      setModelState("offline");
      return;
    }
    setModelState((current) => (current === "online" ? current : "connecting"));
    try {
      const response = await fetch(`${apiUrl}/health`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error("Health check failed");
      const data = (await response.json()) as HealthResponse;
      const step = data.checkpointStep ?? data.model?.checkpointStep;
      if (step !== 3500 || data.status !== "ok") throw new Error("Unexpected model version");
      setModelBase(data.model?.base ?? "GLM-OCR-ca5d8b3");
      setModelState("online");
    } catch {
      setModelState("offline");
    }
  }, [apiUrl]);

  useEffect(() => {
    void checkHealth();
    const interval = window.setInterval(() => void checkHealth(), 15000);
    return () => window.clearInterval(interval);
  }, [checkHealth]);

  const runSample = useCallback(async () => {
    setErrorMessage("");
    setIsSample(true);
    setFile(null);
    setFileName(sampleMeta.filename);
    setFileSize(sampleMeta.sizeLabel);
    setDimensions({ width: sampleMeta.width, height: sampleMeta.height });
    setImageUrl(SAMPLE_IMAGE_URL);
    setText("");
    setActiveRegion(null);
    setProcessState("uploading");
    await sleep(360);
    setProcessState("analyzing");
    await sleep(640);
    setProcessState("recognizing");
    await sleep(780);
    setText(sampleFullText);
    setProcessingMs(sampleMeta.processingMs);
    setProcessState("success");
  }, []);

  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: "load_dunhuang_sample",
            title: "Load Dunhuang OCR sample",
            description: "Load and analyze the built-in Dunhuang manuscript sample in the visible OCR workspace.",
            inputSchema: { type: "object", properties: {}, additionalProperties: false },
            annotations: { readOnlyHint: false, untrustedContentHint: false },
            async execute() {
              await runSample();
              return { status: "complete", regions: sampleRegions.length, checkpointStep: 3500 };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => undefined);
    } catch {
      // WebMCP is optional and unsupported browsers use the visible interface.
    }
    return () => lifecycle.abort();
  }, [runSample]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const prepareFile = async (nextFile: File) => {
    setErrorMessage("");
    if (!ACCEPTED_TYPES.has(nextFile.type)) {
      setProcessState("error");
      setErrorMessage("Use a JPG, PNG, or WebP image.");
      return;
    }
    if (nextFile.size > MAX_FILE_SIZE) {
      setProcessState("error");
      setErrorMessage("The image is larger than the 10 MB limit.");
      return;
    }

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const nextUrl = URL.createObjectURL(nextFile);
    objectUrlRef.current = nextUrl;
    const image = new Image();
    const nextDimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error("The selected file is not a readable image."));
      image.src = nextUrl;
    }).catch((error: Error) => {
      setProcessState("error");
      setErrorMessage(error.message);
      return null;
    });
    if (!nextDimensions) return;

    setFile(nextFile);
    setImageUrl(nextUrl);
    setFileName(nextFile.name);
    setFileSize(`${(nextFile.size / 1024 / 1024).toFixed(2)} MB`);
    setDimensions(nextDimensions);
    setIsSample(false);
    setText("");
    setProcessingMs(0);
    setActiveRegion(null);
    setProcessState("idle");
  };

  const runOcr = async () => {
    if (!file || modelState !== "online" || isProcessing) return;
    setErrorMessage("");
    setText("");
    setProcessState("uploading");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 120000);
    const stageTimer = (async () => {
      await sleep(320);
      setProcessState("analyzing");
      await sleep(680);
      setProcessState("recognizing");
      await sleep(650);
    })();
    try {
      const form = new FormData();
      form.append("file", file);
      const [response] = await Promise.all([
        fetch(`${apiUrl}/v1/ocr`, { method: "POST", body: form, signal: controller.signal }),
        stageTimer,
      ]);
      const payload = await response.json().catch(() => null) as OcrResponse | { detail?: string } | null;
      if (!response.ok) {
        throw new Error((payload && "detail" in payload && payload.detail) || "Recognition failed. Please try again.");
      }
      const result = payload as OcrResponse;
      if (result.model.checkpointStep !== 3500) throw new Error("The service returned an unexpected checkpoint.");
      setText(result.text);
      setProcessingMs(result.processingMs);
      setDimensions({ width: result.imageWidth, height: result.imageHeight });
      setModelBase(result.model.base);
      setProcessState("success");
    } catch (error) {
      setProcessState("error");
      setErrorMessage(error instanceof DOMException && error.name === "AbortError"
        ? "Recognition timed out after 120 seconds."
        : error instanceof Error ? error.message : "Recognition failed. Please try again.");
    } finally {
      window.clearTimeout(timeout);
    }
  };

  const reset = () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    setFile(null);
    setImageUrl("");
    setFileName("");
    setFileSize("");
    setDimensions({ width: 0, height: 0 });
    setText("");
    setProcessingMs(0);
    setIsSample(false);
    setProcessState("idle");
    setErrorMessage("");
    setActiveRegion(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const copyText = async () => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopyState("copied");
    window.setTimeout(() => setCopyState("idle"), 1600);
  };

  const downloadText = () => {
    if (!text) return;
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${fileName.replace(/\.[^.]+$/, "") || "ocr-result"}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files[0];
    if (dropped) void prepareFile(dropped);
  };

  const focusRegion = (id: string) => {
    setActiveRegion(id);
    resultItemsRef.current[id]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  return (
    <main className="app-shell min-h-screen text-foreground">
      <header className="mx-auto flex h-[72px] max-w-[1720px] items-center justify-between px-5 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="brand-mark"><ScanLine aria-hidden="true" /></div>
          <div>
            <p className="font-display text-[15px] font-semibold tracking-[0.12em] text-white">SRT OCR</p>
            <p className="text-[11px] tracking-[0.16em] text-cyan-200/50">VISUAL RECOGNITION LAB</p>
          </div>
        </div>
        <button className={`model-status ${modelState}`} onClick={() => void checkHealth()} aria-label="Refresh model connection">
          <span className="status-dot" />
          {modelState === "online" ? "Model Online" : modelState === "connecting" ? "Connecting" : "Model Offline"}
          <span className="model-step">/ 3500</span>
        </button>
      </header>

      <section className="mx-auto max-w-[1720px] px-5 pb-5 lg:px-8 lg:pb-8">
        <div className="workspace-grid">
          <section
            className={`panel panel-image ${dragging ? "is-dragging" : ""}`}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <div className="panel-header">
              <div>
                <span className="eyebrow">INPUT / {isSample ? "LAYOUT SAMPLE" : file ? "CUSTOM DOCUMENT" : "NO DOCUMENT"}</span>
                <h1>Source image</h1>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button variant="ghost" size="sm" className="subtle-button" onClick={() => void runSample()} disabled={isProcessing}>
                  <Play /> Try sample
                </Button>
                <Button variant="outline" size="sm" className="tech-button" onClick={() => inputRef.current?.click()} disabled={isProcessing}>
                  <Upload /> Upload image
                </Button>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(event) => { const selected = event.target.files?.[0]; if (selected) void prepareFile(selected); }}
                />
              </div>
            </div>

            <div className="image-stage">
              {imageUrl ? (
                <div className="document-frame">
                  <img src={imageUrl} alt={isSample ? "Dunhuang manuscript OCR sample" : "Uploaded document"} />
                  {isSample && processState === "success" && sampleRegions.map((region) => (
                    <button
                      key={region.id}
                      className={`region-box ${activeRegion === region.id ? "active" : ""}`}
                      style={{
                        left: `${region.bbox[0] * 100}%`, top: `${region.bbox[1] * 100}%`,
                        width: `${(region.bbox[2] - region.bbox[0]) * 100}%`,
                        height: `${(region.bbox[3] - region.bbox[1]) * 100}%`,
                      }}
                      aria-label={`Region ${region.order}: ${region.text}`}
                      onMouseEnter={() => setActiveRegion(region.id)}
                      onMouseLeave={() => setActiveRegion(null)}
                      onFocus={() => focusRegion(region.id)}
                      onClick={() => focusRegion(region.id)}
                    ><span>{String(region.order).padStart(2, "0")}</span></button>
                  ))}
                  {isProcessing && <div className="scan-beam" aria-hidden="true" />}
                  <div className="frame-corner corner-tl" /><div className="frame-corner corner-tr" />
                  <div className="frame-corner corner-bl" /><div className="frame-corner corner-br" />
                </div>
              ) : (
                <Empty className="upload-empty" onClick={() => inputRef.current?.click()}>
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><FileImage /></EmptyMedia>
                    <EmptyTitle>Drop a document here</EmptyTitle>
                    <EmptyDescription>JPG, PNG or WebP · Up to 10 MB</EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent><Button className="tech-button" variant="outline"><Upload /> Select image</Button></EmptyContent>
                </Empty>
              )}

              {isProcessing && (
                <div className="process-card" role="status" aria-live="polite">
                  <div className="flex items-center justify-between gap-8">
                    <span className="flex items-center gap-2"><LoaderCircle className="size-3.5 animate-spin" />{processLabel(processState)}</span>
                    <span>{processProgress(processState)}%</span>
                  </div>
                  <Progress value={processProgress(processState)} className="mt-3 h-1 bg-white/10" />
                </div>
              )}

              {imageUrl && !isSample && processState === "idle" && (
                <div className="analyze-card">
                  <Button onClick={() => void runOcr()} disabled={modelState !== "online"} className="run-button">
                    {modelState === "online" ? <><ScanLine /> Run recognition</> : <><ServerOff /> Model offline</>}
                  </Button>
                  {modelState !== "online" && <p>Connect the GPU service to analyze this image.</p>}
                </div>
              )}
            </div>

            <div className="panel-footer">
              <span>{dimensions.width && dimensions.height ? `${dimensions.width} × ${dimensions.height} PX` : "NO IMAGE"}</span>
              <span className="truncate">{fileName || "—"}{fileSize ? ` · ${fileSize}` : ""}</span>
              <span className={isSample ? "text-cyan-200" : "text-white/35"}>{isSample ? "LAYOUT SAMPLE" : "TEXT MODE"}</span>
            </div>
          </section>

          <section className="panel panel-result">
            <div className="panel-header">
              <div>
                <span className="eyebrow">OUTPUT / CHECKPOINT 3500</span>
                <h2>Recognition result</h2>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon-sm" className="icon-button" onClick={() => void copyText()} disabled={!text} aria-label="Copy text">
                  {copyState === "copied" ? <Check /> : <Copy />}
                </Button>
                <Button variant="ghost" size="icon-sm" className="icon-button" onClick={downloadText} disabled={!text} aria-label="Download text"><Download /></Button>
                <Button variant="ghost" size="icon-sm" className="icon-button" onClick={reset} disabled={isProcessing} aria-label="Reset workspace"><RotateCcw /></Button>
              </div>
            </div>

            <div className="result-summary">
              <div><span>MODE</span><strong>{isSample ? "LAYOUT SAMPLE" : "TEXT ONLY"}</strong></div>
              <div><span>{isSample ? "REGIONS" : "CHARACTERS"}</span><strong>{isSample ? sampleRegions.length : characterCount || "—"}</strong></div>
              <div><span>{isSample ? "DIRECTION" : "LATENCY"}</span><strong>{isSample ? "VERTICAL RTL" : processingMs ? `${(processingMs / 1000).toFixed(2)} S` : "—"}</strong></div>
            </div>

            <div className="result-body" aria-live="polite">
              <div className="result-body-header">
                <span className="eyebrow flex items-center gap-2"><FileText className="size-3.5" /> EXTRACTED TEXT</span>
                <span>{characterCount ? `${characterCount} characters` : "Awaiting result"}</span>
              </div>

              {isProcessing ? (
                <div className="space-y-4 pt-7">
                  <Skeleton className="h-4 w-[92%] bg-cyan-200/10" /><Skeleton className="h-4 w-[84%] bg-cyan-200/10" />
                  <Skeleton className="h-4 w-[96%] bg-cyan-200/10" /><Skeleton className="h-4 w-[68%] bg-cyan-200/10" />
                </div>
              ) : processState === "error" ? (
                <Empty className="result-empty">
                  <EmptyHeader><EmptyMedia variant="icon"><ServerOff /></EmptyMedia><EmptyTitle>Recognition unavailable</EmptyTitle><EmptyDescription>{errorMessage}</EmptyDescription></EmptyHeader>
                  <EmptyContent><Button variant="outline" className="tech-button" onClick={() => file ? void runOcr() : void checkHealth()}>Try again</Button></EmptyContent>
                </Empty>
              ) : isSample && text ? (
                <div className="region-results" lang="zh-Hant">
                  {sampleRegions.map((region) => (
                    <button
                      key={region.id}
                      ref={(element) => { resultItemsRef.current[region.id] = element; }}
                      className={`region-result ${activeRegion === region.id ? "active" : ""}`}
                      onMouseEnter={() => setActiveRegion(region.id)}
                      onMouseLeave={() => setActiveRegion(null)}
                      onFocus={() => setActiveRegion(region.id)}
                      onClick={() => setActiveRegion(region.id)}
                    >
                      <span>{String(region.order).padStart(2, "0")}</span><p>{region.text}</p>
                    </button>
                  ))}
                </div>
              ) : text ? (
                <p lang="zh-Hant" className="ocr-text">{text}</p>
              ) : (
                <Empty className="result-empty">
                  <EmptyHeader><EmptyMedia variant="icon"><FileText /></EmptyMedia><EmptyTitle>No result yet</EmptyTitle><EmptyDescription>Upload a document, then run Checkpoint 3500 recognition.</EmptyDescription></EmptyHeader>
                </Empty>
              )}
            </div>

            <div className="panel-footer">
              <span>{modelBase.replace(/.*\//, "")}</span><span>BF16 · GREEDY</span><span className="text-cyan-200">CHECKPOINT 3500</span>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
