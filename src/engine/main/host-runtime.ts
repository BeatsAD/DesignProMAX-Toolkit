// Migrated from DesignProMAX v1.0.48; adapted and maintained independently for Figma.
export type TaskCancellationSignal = {
  readonly aborted: boolean;
  onCancel: (listener: () => void) => () => void;
};

export type HostRgba = {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
};

export type HostSolidPaint = {
  readonly type: 'SOLID';
  readonly color: HostRgba;
  readonly isVisible?: boolean;
  readonly alpha?: number;
  readonly blendMode?: string;
};

export type HostTextSegStyle = {
  start: number;
  end: number;
  textStyle?: {
    fontName?: unknown;
    localizedFontName?: unknown;
    fontSize?: unknown;
  };
  fills?: unknown;
};

export type HostNode = {
  readonly removed?: boolean;
  id: string;
  name: string;
  type: string;
  isVisible?: boolean;
  isLocked?: boolean;
  visible?: boolean;
  locked?: boolean;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  rotation?: number;
  opacity?: number;
  relativeTransform?: [[number, number, number], [number, number, number]];
  absoluteTransform?: [[number, number, number], [number, number, number]];
  strokes?: unknown;
  layoutMode?: 'NONE' | 'HORIZONTAL' | 'VERTICAL' | string;
  layoutSizingHorizontal?: 'FIXED' | 'HUG' | 'FILL' | string;
  layoutSizingVertical?: 'FIXED' | 'HUG' | 'FILL' | string;
  layoutGrow?: number;
  layoutAlign?: 'INHERIT' | 'STRETCH' | string;
  primaryAxisSizingMode?: 'FIXED' | 'AUTO' | string;
  counterAxisSizingMode?: 'FIXED' | 'AUTO' | string;
  itemSpacing?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  minWidth?: number | null;
  maxWidth?: number | null;
  minHeight?: number | null;
  maxHeight?: number | null;
  clipsContent?: boolean;
  textAutoResize?: string;
  constrainProportions?: boolean;
  constraints?: {
    horizontal?: 'START' | 'END' | 'STARTANDEND' | 'CENTER' | 'SCALE' | string;
    vertical?: 'START' | 'END' | 'STARTANDEND' | 'CENTER' | 'SCALE' | string;
  };
  fontName?: unknown;
  fontSize?: unknown;
  lineHeight?: unknown;
  letterSpacing?: unknown;
  paragraphSpacing?: unknown;
  strokeWeight?: number;
  strokeAlign?: unknown;
  cornerRadius?: unknown;
  topLeftRadius?: unknown;
  topRightRadius?: unknown;
  bottomRightRadius?: unknown;
  bottomLeftRadius?: unknown;
  effects?: unknown;
  parent?: HostNode | null;
  children?: HostNode[];
  fills?: unknown;
  characters?: string;
  textStyles?: ReadonlyArray<HostTextSegStyle>;
  remove?: () => void;
  rescale?: (scale: number, scaleOption?: { scaleCenter?: 'TOPLEFT' | 'TOP' | 'TOPRIGHT' | 'LEFT' | 'CENTER' | 'RIGHT' | 'BOTTOMLEFT' | 'BOTTOM' | 'BOTTOMRIGHT' }) => void;
  resize?: (width: number, height: number) => void;
  resizeWithoutConstraints?: (width: number, height: number) => void;
  clone?: () => HostNode;
  createInstance?: () => HostNode;
  appendChild?: (node: HostNode) => void;
  findAll?: () => HostNode[];
  exportAsync?: (settings?: unknown) => Promise<Uint8Array> | Uint8Array;
  getRangeFontName?: (start: number, end: number) => unknown;
  getRangeFontSize?: (start: number, end: number) => unknown;
  getRangeFills?: (start: number, end: number) => unknown;
  setRangeFontName?: (start: number, end: number, fontName: unknown) => void;
  setRangeFontSize?: (start: number, end: number, fontSize: number) => void;
  setRangeFills?: (start: number, end: number, fills: ReadonlyArray<HostSolidPaint>) => void;
};

export type HostRuntime = {
  getNodeByIdAsync?: (id: string) => Promise<HostNode | undefined>;
  beginUndoStep?: () => void;
  rollbackUndoStep?: () => void;
  command?: string;
  name?: string;
  root?: {
    name?: string;
  };
  document: {
    name?: string;
    currentPage: HostNode & {
      selection: HostNode[];
    };
    children?: Array<HostNode & { selection?: HostNode[] }>;
    pages?: Array<HostNode & { selection?: HostNode[] }>;
  };
  ui: {
    onmessage: ((message: unknown) => void | Promise<void>) | null;
    postMessage: (message: unknown) => void;
    hide?: () => void;
    resize?: (width: number, height: number) => void;
  };
  showUI: (html: string, options?: { width: number; height: number }) => void;
  closePlugin?: (message?: string) => void;
  on?: (eventName: string, callback: (event?: unknown) => void) => void;
  clientStorage: {
    getAsync<T = unknown>(key: string): Promise<T | undefined>;
    setAsync<T = unknown>(key: string, value: T): Promise<void>;
    deleteAsync(key: string): Promise<void>;
  };
  listAvailableFontsAsync?: () => Promise<unknown[]>;
  loadFontAsync?: (fontName: unknown) => Promise<void>;
  createText?: () => HostNode;
  createImage?: (bytes: Uint8Array) => Promise<unknown> | unknown;
  createRectangle?: () => HostNode;
  createNodeFromSvgAsync?: (svg: string) => Promise<HostNode> | HostNode;
  getImageByHref?: (href: string) => { getBytesAsync: () => Promise<Uint8Array> };
  getTeamLibraryAsync?: () => Promise<unknown>;
  importComponentByKeyAsync?: (key: string) => Promise<HostNode> | HostNode;
  importComponentSetByKeyAsync?: (key: string) => Promise<HostNode> | HostNode;
  commitUndo?: () => void;
  getNodeByPosition?: (x: number, y: number) => HostNode | null | undefined;
  viewport?: {
    center?: { x: number; y: number };
    scrollAndZoomIntoView?: (nodes: HostNode[]) => void;
  };
};

export type HandlerContext = {
  expectedNodes?: Map<string, string>;
  expectedTargets?: readonly HostNode[];
  expectedSelection?: {pageId: string; ids: string[]};
  host: HostRuntime;
  signal?: TaskCancellationSignal;
  reportProgress?: (current: number, total: number, text: string) => void;
};

export function hasChildren(node: HostNode): node is HostNode & { children: HostNode[] } {
  return Array.isArray(node.children);
}
