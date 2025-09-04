export interface ComponentType {
  id: string;
  type: 'text' | 'image' | 'table' | 'grid';
  x: number;
  y: number;
  width: number;
  height: number;
  content?: string;
  fontSize?: number;
  color?: string;
  fontWeight?: 'normal' | 'bold';
  textAlign?: 'left' | 'center' | 'right';
  lineHeight?: number;
  
  // 表格组件专用属性
  gridRows?: number;
  gridColumns?: number;
  gridRowHeights?: number[];
  gridColumnWidths?: number[];
  gridCells?: { [key: string]: ComponentType[] };
  
  // 多维表格组件专用属性
  selectedTableId?: string;
  tableViews?: any[];
  selectedViewId?: string;
  viewFields?: any[];
  headerBackgroundColor?: string;
  headerFontWeight?: 'normal' | 'bold';
}

export interface FieldListProps {
  className?: string;
}

export interface CanvasProps {
  components: ComponentType[];
  selectedComponent: string | null;
  onComponentSelect: (id: string) => void;
  onComponentUpdate: (id: string, updates: Partial<ComponentType>) => void;
  onComponentDelete: (id: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onClick: (e: React.MouseEvent) => void;
  size: { width: number; height: number };
  zoom: number;
  showGrid: boolean;
  gridSize: number;
  snapToGrid: boolean;
  isDragging: boolean;
  setIsDragging: (dragging: boolean) => void;
  dragOffset: { x: number; y: number };
  setDragOffset: (offset: { x: number; y: number }) => void;
  isResizing: boolean;
  setIsResizing: (resizing: boolean) => void;
  resizeHandle: string;
  setResizeHandle: (handle: string) => void;
}

export interface PropertyPanelProps {
  component: ComponentType | null;
  onUpdate: (updates: Partial<ComponentType>) => void;
  allTables: any[];
  fetchTableViews: (tableId: string) => Promise<any[]>;
  fetchViewFields: (tableId: string, viewId: string) => Promise<any[]>;
}