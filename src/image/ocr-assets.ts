import { gunzipSync } from 'fflate';

export const OCR_EMBEDDED_PAYLOAD_ID = 'figma-ocr-payload';
export const OCR_EMBEDDED_CORE_PATH = 'https://designpromax.invalid/ocr/tesseract-core-lstm.wasm.js';
export const OCR_EMBEDDED_LANG_PATH = 'https://designpromax.invalid/ocr';

export type EmbeddedOcrStage = 'payload-read' | 'worker-bootstrap';

type OcrPayloadAsset = {
  encoding: 'base64' | 'gzip-base64';
  mimeType: string;
  data: string;
};

export type OcrEmbeddedPayload = {
  version: 1;
  assets: {
    worker: OcrPayloadAsset;
    core: OcrPayloadAsset;
    eng: OcrPayloadAsset;
    chiSim: OcrPayloadAsset;
  };
};

export type EmbeddedOcrRuntime = {
  workerPath: string;
  corePath: string;
  langPath: string;
  release: () => void;
};

type OcrPayloadAssetName = keyof OcrEmbeddedPayload['assets'];

const REQUIRED_ASSETS: OcrPayloadAssetName[] = ['worker', 'core', 'eng', 'chiSim'];

/**
 * OCR 资源在插件 HTML 中是 inert JSON，只有用户触发识别时才读取、解压并转成 Blob。
 * 这里不使用 window.location、document.baseURI、插件 assets 路径或任何 CDN。
 */
export function createEmbeddedOcrRuntime(onStage?: (stage: EmbeddedOcrStage) => void, suppliedPayload?: OcrEmbeddedPayload): EmbeddedOcrRuntime {
  onStage?.('payload-read');
  const payload = suppliedPayload ? validateOcrEmbeddedPayload(suppliedPayload) : readEmbeddedOcrPayload();
  const objectUrls: string[] = [];
  const createUrl = (assetName: OcrPayloadAssetName) => {
    const asset = payload.assets[assetName];
    const bytes = decodeOcrPayloadAsset(asset);
    const url = URL.createObjectURL(new Blob([exactArrayBuffer(bytes)], { type: asset.mimeType }));
    objectUrls.push(url);
    return url;
  };

  try {
    const workerSourceUrl = createUrl('worker');
    const coreSourceUrl = createUrl('core');
    const engSourceUrl = createUrl('eng');
    const chiSimSourceUrl = createUrl('chiSim');
    onStage?.('worker-bootstrap');
    const workerBootstrap = new Blob([
      buildOcrWorkerBootstrapSource({
        workerSourceUrl,
        coreSourceUrl,
        engSourceUrl,
        chiSimSourceUrl
      })
    ], { type: 'application/javascript' });
    const workerPath = URL.createObjectURL(workerBootstrap);
    objectUrls.push(workerPath);

    let released = false;
    return {
      workerPath,
      corePath: OCR_EMBEDDED_CORE_PATH,
      langPath: OCR_EMBEDDED_LANG_PATH,
      release: () => {
        if (released) return;
        released = true;
        for (const objectUrl of objectUrls) URL.revokeObjectURL(objectUrl);
      }
    };
  } catch (error) {
    for (const objectUrl of objectUrls) URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

export function readEmbeddedOcrPayload(documentRef: Document = document): OcrEmbeddedPayload {
  const element = documentRef.getElementById(OCR_EMBEDDED_PAYLOAD_ID);
  if (!element?.textContent?.trim()) throw new Error('OCR_EMBEDDED_PAYLOAD_MISSING');

  try {
    return validateOcrEmbeddedPayload(JSON.parse(element.textContent));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('OCR_EMBEDDED_PAYLOAD_')) throw error;
    throw new Error('OCR_EMBEDDED_PAYLOAD_INVALID');
  }
}

export function validateOcrEmbeddedPayload(value: unknown): OcrEmbeddedPayload {
  if (!value || typeof value !== 'object') throw new Error('OCR_EMBEDDED_PAYLOAD_INVALID');
  const payload = value as Partial<OcrEmbeddedPayload>;
  if (payload.version !== 1 || !payload.assets || typeof payload.assets !== 'object') {
    throw new Error('OCR_EMBEDDED_PAYLOAD_INVALID');
  }

  for (const assetName of REQUIRED_ASSETS) {
    const asset = payload.assets[assetName];
    if (!asset || typeof asset !== 'object'
      || (asset.encoding !== 'base64' && asset.encoding !== 'gzip-base64')
      || typeof asset.mimeType !== 'string' || !asset.mimeType
      || typeof asset.data !== 'string' || !asset.data) {
      throw new Error('OCR_EMBEDDED_PAYLOAD_INVALID');
    }
  }

  return payload as OcrEmbeddedPayload;
}

export function decodeOcrPayloadAsset(asset: OcrPayloadAsset): Uint8Array {
  const compressed = decodeBase64(asset.data);
  try {
    return asset.encoding === 'gzip-base64' ? gunzipSync(compressed) : compressed;
  } catch {
    throw new Error('OCR_EMBEDDED_PAYLOAD_INVALID');
  }
}

export function decodeBase64(value: string): Uint8Array {
  if (!value || !/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) {
    throw new Error('OCR_EMBEDDED_PAYLOAD_INVALID');
  }
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    throw new Error('OCR_EMBEDDED_PAYLOAD_INVALID');
  }
}

export function buildOcrWorkerBootstrapSource({
  workerSourceUrl,
  coreSourceUrl,
  engSourceUrl,
  chiSimSourceUrl
}: {
  workerSourceUrl: string;
  coreSourceUrl: string;
  engSourceUrl: string;
  chiSimSourceUrl: string;
}): string {
  const languageUrls = {
    [`${OCR_EMBEDDED_LANG_PATH}/eng.traineddata.gz`]: engSourceUrl,
    [`${OCR_EMBEDDED_LANG_PATH}/chi_sim.traineddata.gz`]: chiSimSourceUrl
  };
  return `(() => {
  const originalImportScripts = self.importScripts.bind(self);
  const originalFetch = self.fetch.bind(self);
  const corePath = ${JSON.stringify(OCR_EMBEDDED_CORE_PATH)};
  const coreSourceUrl = ${JSON.stringify(coreSourceUrl)};
  const languageUrls = ${JSON.stringify(languageUrls)};
  self.importScripts = (...urls) => originalImportScripts(...urls.map((url) => {
    const mapped = String(url) === corePath ? coreSourceUrl : String(url);
    if (!mapped.startsWith('blob:')) throw new Error('OCR_LOCAL_RESOURCE_ONLY');
    return mapped;
  }));
  self.fetch = (resource, init) => {
    const requestedUrl = typeof resource === 'string' ? resource : resource && resource.url;
    const mapped = languageUrls[requestedUrl] || requestedUrl;
    if (typeof mapped !== 'string' || !(mapped.startsWith('blob:') || mapped.startsWith('data:application/octet-stream;base64,AGFzbQE'))) return Promise.reject(new Error('OCR_LOCAL_RESOURCE_ONLY'));
    return originalFetch(mapped, init);
  };
  originalImportScripts(${JSON.stringify(workerSourceUrl)});
})();`;
}

function exactArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  if (bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength && bytes.buffer instanceof ArrayBuffer) {
    return bytes.buffer;
  }
  return bytes.slice().buffer as ArrayBuffer;
}
