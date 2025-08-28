import React, { useState, useEffect } from 'react';
import './App.css';
import FieldList from './components/FieldList';
import { bitable } from '@lark-base-open/js-sdk';

interface CanvasComponent {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  color?: string;
  fontWeight?: 'normal' | 'bold';
  textAlign?: 'left' | 'center' | 'right';
  lineHeight?: number;
  textContent?: string; // 文本组件的内容
  selectedTableId?: string; // 多维表格组件选中的数据表ID
  tableFields?: any[]; // 多维表格组件的字段列表
  selectedFields?: string[]; // 多维表格组件选中要显示的字段ID列表
  fieldOrder?: string[]; // 多维表格组件字段显示顺序
  headerBackgroundColor?: string; // 表头背景颜色
  headerFontWeight?: 'normal' | 'bold'; // 表头文字加粗
  printMode?: 'all' | 'current'; // 多维表格组件打印模式：全部数据或当前视图数据
  showRowNumber?: boolean; // 多维表格组件是否显示序号列
  // 新增表格组件属性
  gridRows?: number; // 表格行数
  gridColumns?: number; // 表格列数
  gridCells?: { [key: string]: CanvasComponent[] }; // 单元格内容，key为"row-col"格式
  gridColumnWidths?: number[]; // 每列的宽度百分比
  gridRowHeights?: number[]; // 每行的高度百分比
  gridMergedCells?: { [key: string]: { rowspan: number; colspan: number } }; // 合并单元格信息，key为"row-col"格式
}

// 模板相关接口
interface Template {
  id: string;
  name: string;
  tableId: string; // 关联的数据表ID
  components: CanvasComponent[]; // 保存的组件配置
  createdAt: number; // 创建时间戳
}

interface AlignmentGuide {
  type: 'vertical' | 'horizontal';
  position: number;
  start: number;
  end: number;
}

function App() {
  const [canvasComponents, setCanvasComponents] = useState<CanvasComponent[]>([]);
  const [draggedComponent, setDraggedComponent] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizingComponent, setResizingComponent] = useState<string | null>(null);
  const [resizeStartPos, setResizeStartPos] = useState({ x: 0, y: 0 });
  const [resizeStartSize, setResizeStartSize] = useState({ width: 0, height: 0 });
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuide[]>([]);
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [tableRecords, setTableRecords] = useState<any[]>([]);
  const [tableFields, setTableFields] = useState<any[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage] = useState(10);
  const [allTables, setAllTables] = useState<any[]>([]);
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  // 模板相关状态
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [currentTableId, setCurrentTableId] = useState<string>('');
  
  // 单元格合并控制状态
  const [mergeStartRow, setMergeStartRow] = useState(0);
  const [mergeStartCol, setMergeStartCol] = useState(0);
  const [mergeEndRow, setMergeEndRow] = useState(0);
  const [mergeEndCol, setMergeEndCol] = useState(0);

  // localStorage工具函数
  const saveTemplatesToStorage = (templatesData: Template[]) => {
    try {
      localStorage.setItem('canvas_templates', JSON.stringify(templatesData));
    } catch (error) {
      console.error('保存模板到localStorage失败:', error);
    }
  };

  const loadTemplatesFromStorage = (): Template[] => {
    try {
      const stored = localStorage.getItem('canvas_templates');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('从localStorage加载模板失败:', error);
      return [];
    }
  };

  // 初始化时从localStorage加载模板数据
  useEffect(() => {
    const storedTemplates = loadTemplatesFromStorage();
    setTemplates(storedTemplates);
  }, []);

  // 单元格合并逻辑函数（返回更新后的组件）
  const mergeCells = (component: CanvasComponent, startRow: number, startCol: number, endRow: number, endCol: number): CanvasComponent => {
    if (component.type !== 'grid') return component;
    
    const updatedMergedCells = { ...component.gridMergedCells };
    const rowspan = endRow - startRow + 1;
    const colspan = endCol - startCol + 1;
    
    // 检查是否有重叠的合并单元格
    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const cellKey = `${row}-${col}`;
        // 如果不是起始单元格，删除可能存在的合并信息
        if (row !== startRow || col !== startCol) {
          delete updatedMergedCells[cellKey];
        }
      }
    }
    
    // 设置起始单元格的合并信息
    const startCellKey = `${startRow}-${startCol}`;
    updatedMergedCells[startCellKey] = { rowspan, colspan };
    
    return { ...component, gridMergedCells: updatedMergedCells };
  };

  // 单元格拆分逻辑函数（返回更新后的组件）
  const splitCell = (component: CanvasComponent, row: number, col: number): CanvasComponent => {
    if (component.type !== 'grid') return component;
    
    const updatedMergedCells = { ...component.gridMergedCells };
    const cellKey = `${row}-${col}`;
    
    // 删除该单元格的合并信息
    delete updatedMergedCells[cellKey];
    
    return { ...component, gridMergedCells: updatedMergedCells };
  };

  // 检查单元格是否被合并覆盖（应该隐藏）
  const isCellCovered = (mergedCells: { [key: string]: { rowspan: number; colspan: number } } | undefined, row: number, col: number) => {
    if (!mergedCells) return false;
    
    for (const [cellKey, mergeInfo] of Object.entries(mergedCells)) {
      const [mergeRow, mergeCol] = cellKey.split('-').map(Number);
      const { rowspan, colspan } = mergeInfo;
      
      // 检查当前单元格是否在合并范围内（但不是起始单元格）
      if (row >= mergeRow && row < mergeRow + rowspan &&
          col >= mergeCol && col < mergeCol + colspan &&
          !(row === mergeRow && col === mergeCol)) {
        return true;
      }
    }
    
    return false;
  };

  // 格式化字段值显示
  const formatFieldValue = (value: any, fieldType?: number) => {
    if (!value) return '-';
    
    // 处理日期时间类型字段 (FieldType.DateTime = 5, FieldType.CreatedTime = 1001, FieldType.ModifiedTime = 1002)
    if (fieldType === 5 || fieldType === 1001 || fieldType === 1002) {
      if (typeof value === 'number') {
        // Base SDK返回的是毫秒时间戳
        const date = new Date(value);
        return date.toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
      }
    }
    
    if (typeof value === 'object') {
      // 处理不同类型的对象
      if (Array.isArray(value)) {
        return value.map(item => {
          if (typeof item === 'object') {
            // 优先显示常见的显示属性
            return item.text || item.name || item.title || item.label || 
                   (item.recordIds ? `关联记录(${item.recordIds.length}条)` : '') ||
                   '对象数据';
          }
          return item;
        }).join(', ');
      }
      
      // 处理单个对象
      if (value.text) return value.text;
      if (value.name) return value.name;
      if (value.url) return value.url;
      if (value.title) return value.title;
      if (value.label) return value.label;
      
      // 处理关联记录类型
      if (value.recordIds && Array.isArray(value.recordIds)) {
        return `关联记录(${value.recordIds.length}条)`;
      }
      
      // 处理选择字段类型
       if (value.options && Array.isArray(value.options)) {
         return value.options.map((opt: any) => opt.text || opt.name || opt).join(', ');
       }
      
      // 处理附件类型
      if (value.token || value.type === 'file') {
        return value.name || '附件';
      }
      
      // 处理用户字段类型
      if (value.id && (value.name || value.en_name)) {
        return value.name || value.en_name;
      }
      
      // 最后回退到简化显示，避免显示复杂JSON
      return '复杂数据';
    }
    
    return String(value);
  };

  // 获取组件应该显示的内容
  const getComponentDisplayValue = (component: CanvasComponent) => {
    // 如果是文本组件，显示其文本内容
    if (component.type === 'text') {
      return component.textContent || '请设置文本内容';
    }
    
    // 如果是多维表格组件，返回特殊标识，在渲染时处理表格显示
    if (component.type === 'table') {
      if (!component.tableFields || component.tableFields.length === 0) {
        return '请选择数据表';
      }
      return '__TABLE_COMPONENT__';
    }
    
    // 如果是表格组件，返回特殊标识，在渲染时处理表格显示
    if (component.type === 'grid') {
      return '__GRID_COMPONENT__';
    }
    
    // 如果没有选中记录，显示字段名称
    if (!selectedRecord) {
      return component.name;
    }
    
    // 查找对应的字段
    const field = tableFields.find(f => f.name === component.name);
    if (!field) {
      return component.name;
    }
    
    // 获取记录中该字段的值
    const fieldValue = selectedRecord.fields[field.id];
    return formatFieldValue(fieldValue, field.type);
  };

  // 计算文本内容所需的高度
  const calculateTextHeight = (text: string, fontSize: number, width: number, lineHeight: number) => {
    // 创建临时canvas来测量文本
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return 50; // 默认高度
    
    context.font = `${fontSize}px Arial`;
    const textWidth = context.measureText(text).width;
    
    // 计算需要的行数
    const lines = Math.ceil(textWidth / (width - 20)); // 减去padding
    
    // 计算总高度（行数 * 字体大小 * 行距 + padding）
    const textHeight = lines * fontSize * lineHeight;
    return Math.max(textHeight + 20, 30); // 至少30px高度，加上padding
  };

  // 自动调整组件高度
  const autoAdjustComponentHeight = (componentId: string) => {
    const component = canvasComponents.find(c => c.id === componentId);
    if (!component) return;
    
    const displayValue = getComponentDisplayValue(component);
    const fontSize = component.fontSize || 18;
    const lineHeight = component.lineHeight || 1.5;
    const newHeight = calculateTextHeight(displayValue, fontSize, component.width, lineHeight);
    
    setCanvasComponents(prev => prev.map(c => 
      c.id === componentId 
        ? { ...c, height: newHeight }
        : c
    ));
  };

  // 获取所有数据表
  const fetchAllTables = async () => {
    try {
      setIsLoadingTables(true);
      const tableMetaList = await bitable.base.getTableMetaList();
      setAllTables(tableMetaList);
    } catch (error) {
      console.error('获取数据表列表失败:', error);
      setAllTables([]);
    } finally {
      setIsLoadingTables(false);
    }
  };

  // 获取数据表记录和字段信息
  const fetchTableData = async () => {
    try {
      setIsLoadingRecords(true);
      
      // 获取当前表格
      const table = await bitable.base.getActiveTable();
      
      // 获取所有表格元数据来找到当前表格的ID
      const tableMetaList = await bitable.base.getTableMetaList();
      const tableName = await table.getName();
      const currentTableMeta = tableMetaList.find(meta => meta.name === tableName);
      if (currentTableMeta) {
        setCurrentTableId(currentTableMeta.id);
      }
      
      // 获取字段信息
      const fieldMetaList = await table.getFieldMetaList();
      setTableFields(fieldMetaList);
      
      // 获取记录数据
      const records = await table.getRecords({
        pageSize: 100 // 限制获取100条记录
      });
      
      setTableRecords(records.records);
    } catch (error) {
      console.error('获取数据表记录失败:', error);
      setTableRecords([]);
      setTableFields([]);
    } finally {
      setIsLoadingRecords(false);
    }
  };

  // 根据表格ID获取字段信息
  const fetchTableFields = async (tableId: string) => {
    try {
      const table = await bitable.base.getTable(tableId);
      const fieldMetaList = await table.getFieldMetaList();
      return fieldMetaList;
    } catch (error) {
      console.error('获取表格字段失败:', error);
      return [];
    }
  };

  // 根据表格ID获取记录数据
  const fetchTableRecords = async (tableId: string) => {
    try {
      const table = await bitable.base.getTable(tableId);
      const records = await table.getRecords({
        pageSize: 5000 // 获取更多记录以支持全部数据打印
      });
      return records.records;
    } catch (error) {
      console.error('获取表格记录失败:', error);
      return [];
    }
  };

  // 根据表格ID获取当前视图的记录数据
  const fetchCurrentViewRecords = async (tableId: string) => {
    try {
      const table = await bitable.base.getTable(tableId);
      const view = await table.getActiveView();
      const records = await view.getVisibleRecordIdList();
      
      // 根据可见记录ID获取完整记录数据
      const recordDetails = await Promise.all(
        records.map(async (recordId) => {
          try {
            if (!recordId) {
              return null;
            }
            return await table.getRecordById(recordId);
          } catch (error) {
            console.error(`获取记录 ${recordId} 失败:`, error);
            return null;
          }
        })
      );
      
      return recordDetails.filter(record => record !== null);
    } catch (error) {
      console.error('获取当前视图记录失败:', error);
      // 如果获取当前视图失败，回退到获取全部记录
      return await fetchTableRecords(tableId);
    }
  };



  // 添加键盘事件监听器
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedComponent) {
        // 删除选中的组件
        setCanvasComponents(prev => prev.filter(c => c.id !== selectedComponent));
        setSelectedComponent(null);
      }
    };

    // 添加事件监听器
    document.addEventListener('keydown', handleKeyDown);

    // 清理函数
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedComponent]);

  // 初始化时获取数据
  useEffect(() => {
    fetchTableData();
    fetchAllTables();
  }, []);

  // 监听选中记录变化，自动调整所有组件高度
  useEffect(() => {
    if (canvasComponents.length > 0) {
      canvasComponents.forEach(component => {
        setTimeout(() => {
          autoAdjustComponentHeight(component.id);
        }, 0);
      });
    }
  }, [selectedRecord, tableFields]);

  const handleComponentMouseDown = (e: React.MouseEvent, componentId: string) => {
    e.preventDefault();
    const component = canvasComponents.find(c => c.id === componentId);
    if (!component) return;
    
    // 设置选中状态
    setSelectedComponent(componentId);
    
    const rect = e.currentTarget.getBoundingClientRect();
    const canvasRect = e.currentTarget.parentElement!.getBoundingClientRect();
    
    setDraggedComponent(componentId);
    setDragOffset({
      x: e.clientX - canvasRect.left - component.x,
      y: e.clientY - canvasRect.top - component.y
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggedComponent) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left - dragOffset.x;
      const y = e.clientY - rect.top - dragOffset.y;
      
      const component = canvasComponents.find(c => c.id === draggedComponent);
      if (!component) return;
      
      // 边界限制
      const maxX = 900 - component.width;
      const maxY = 1285 - component.height;
      let constrainedX = Math.max(0, Math.min(x, maxX));
      let constrainedY = Math.max(0, Math.min(y, maxY));
      
      // 检测对齐辅助线
      const guides = detectAlignmentGuides(draggedComponent, constrainedX, constrainedY, component.width, component.height);
      setAlignmentGuides(guides);
      
      // 应用自动吸附
      const snapped = snapToAlignment(constrainedX, constrainedY, component.width, component.height, guides);
      constrainedX = snapped.x;
      constrainedY = snapped.y;
      
      setCanvasComponents(prev => 
        prev.map(c => 
          c.id === draggedComponent 
            ? { ...c, x: constrainedX, y: constrainedY }
            : c
        )
      );
    } else if (resizingComponent) {
      handleResizeMouseMove(e);
    }
  };

  const handleMouseUp = () => {
    setDraggedComponent(null);
    setDragOffset({ x: 0, y: 0 });
    setResizingComponent(null);
    setAlignmentGuides([]); // 清除对齐辅助线
  };

  const handleResizeMouseDown = (e: React.MouseEvent, componentId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const component = canvasComponents.find(c => c.id === componentId);
    if (!component) return;
    
    setResizingComponent(componentId);
    setResizeStartPos({ x: e.clientX, y: e.clientY });
    setResizeStartSize({ width: component.width, height: component.height });
  };

  const handleResizeMouseMove = (e: React.MouseEvent) => {
    if (!resizingComponent) return;
    
    const component = canvasComponents.find(c => c.id === resizingComponent);
    if (!component) return;
    
    const deltaX = e.clientX - resizeStartPos.x;
    const deltaY = e.clientY - resizeStartPos.y;
    
    let newWidth = Math.max(50, resizeStartSize.width + deltaX);
    let newHeight = Math.max(30, resizeStartSize.height + deltaY);
    
    // 网格对齐 - 45px网格
    const gridSize = 45;
    const gridThreshold = 10;
    
    // 计算最近的网格尺寸
    const nearestGridWidth = Math.round(newWidth / gridSize) * gridSize;
    const nearestGridHeight = Math.round(newHeight / gridSize) * gridSize;
    
    // 如果距离网格尺寸足够近，则对齐到网格
    if (Math.abs(newWidth - nearestGridWidth) <= gridThreshold && nearestGridWidth >= 50) {
      newWidth = nearestGridWidth;
    }
    if (Math.abs(newHeight - nearestGridHeight) <= gridThreshold && nearestGridHeight >= 30) {
      newHeight = nearestGridHeight;
    }
    
    // 边界限制
    const maxWidth = 900 - component.x;
    const maxHeight = 1285 - component.y;
    const constrainedWidth = Math.min(newWidth, maxWidth);
    const constrainedHeight = Math.min(newHeight, maxHeight);
    
    setCanvasComponents(prev => 
      prev.map(c => 
        c.id === resizingComponent 
          ? { ...c, width: constrainedWidth, height: constrainedHeight }
          : c
      )
    );
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    try {
      const fieldData = JSON.parse(e.dataTransfer.getData('application/json'));
      const newComponent: CanvasComponent = {
        id: `${fieldData.id}_${Date.now()}`,
        name: fieldData.name,
        type: fieldData.type,
        x: fieldData.type === 'table' ? 0 : Math.max(0, Math.min(x - 50, 800)), // 多维表格组件占满画布宽度，其他组件限制在画布内
        y: Math.max(0, Math.min(y - 25, 1235)), // 限制在画布内，预留组件高度
        width: fieldData.type === 'table' ? 900 : (fieldData.type === 'grid' ? 180 : 100),
        height: fieldData.type === 'grid' ? 90 : 45,
        // 如果是文本组件，设置默认文本内容
        ...(fieldData.type === 'text' && { textContent: '双击编辑文本' }),
        // 如果是多维表格组件，设置默认属性
        ...(fieldData.type === 'table' && { 
          selectedTableId: '', 
          tableFields: [], 
          selectedFields: [], 
          fieldOrder: [],
          printMode: 'current', // 默认打印当前视图数据
          showRowNumber: true // 默认显示序号列
        }),
        // 如果是表格组件，设置默认属性
        ...(fieldData.type === 'grid' && { 
          gridRows: 2, 
          gridColumns: 4, 
          gridCells: {},
          gridColumnWidths: [25, 25, 25, 25], // 默认4列等宽
          gridRowHeights: [50, 50], // 默认2行等高
          gridMergedCells: {} // 默认无合并单元格
        })
      };
      
      setCanvasComponents(prev => {
        const updated = [...prev, newComponent];
        // 异步调整新组件的高度
        setTimeout(() => {
          autoAdjustComponentHeight(newComponent.id);
        }, 0);
        return updated;
      });
    } catch (error) {
      console.error('处理拖拽数据失败:', error);
    }
  };

  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const detectAlignmentGuides = (draggedId: string, draggedX: number, draggedY: number, draggedWidth: number, draggedHeight: number): AlignmentGuide[] => {
    const guides: AlignmentGuide[] = [];
    const threshold = 5; // 对齐阈值，像素
    
    const otherComponents = canvasComponents.filter(c => c.id !== draggedId);
    
    otherComponents.forEach(component => {
      // 垂直对齐检测
      // 左边对齐
      if (Math.abs(draggedX - component.x) <= threshold) {
        guides.push({
          type: 'vertical',
          position: component.x,
          start: Math.min(draggedY, component.y),
          end: Math.max(draggedY + draggedHeight, component.y + component.height)
        });
      }
      // 右边对齐
      if (Math.abs((draggedX + draggedWidth) - (component.x + component.width)) <= threshold) {
        guides.push({
          type: 'vertical',
          position: component.x + component.width,
          start: Math.min(draggedY, component.y),
          end: Math.max(draggedY + draggedHeight, component.y + component.height)
        });
      }
      // 中心对齐（垂直）
      const draggedCenterX = draggedX + draggedWidth / 2;
      const componentCenterX = component.x + component.width / 2;
      if (Math.abs(draggedCenterX - componentCenterX) <= threshold) {
        guides.push({
          type: 'vertical',
          position: componentCenterX,
          start: Math.min(draggedY, component.y),
          end: Math.max(draggedY + draggedHeight, component.y + component.height)
        });
      }
      
      // 水平对齐检测
      // 顶部对齐
      if (Math.abs(draggedY - component.y) <= threshold) {
        guides.push({
          type: 'horizontal',
          position: component.y,
          start: Math.min(draggedX, component.x),
          end: Math.max(draggedX + draggedWidth, component.x + component.width)
        });
      }
      // 底部对齐
      if (Math.abs((draggedY + draggedHeight) - (component.y + component.height)) <= threshold) {
        guides.push({
          type: 'horizontal',
          position: component.y + component.height,
          start: Math.min(draggedX, component.x),
          end: Math.max(draggedX + draggedWidth, component.x + component.width)
        });
      }
      // 中心对齐（水平）
      const draggedCenterY = draggedY + draggedHeight / 2;
      const componentCenterY = component.y + component.height / 2;
      if (Math.abs(draggedCenterY - componentCenterY) <= threshold) {
        guides.push({
          type: 'horizontal',
          position: componentCenterY,
          start: Math.min(draggedX, component.x),
          end: Math.max(draggedX + draggedWidth, component.x + component.width)
        });
      }
    });
    
    return guides;
  };

  const snapToAlignment = (x: number, y: number, width: number, height: number, guides: AlignmentGuide[]): { x: number, y: number } => {
    let snappedX = x;
    let snappedY = y;
    
    // 网格对齐 - 45px网格
    const gridSize = 45;
    const gridThreshold = 10; // 网格对齐阈值
    
    // 计算最近的网格点
    const nearestGridX = Math.round(x / gridSize) * gridSize;
    const nearestGridY = Math.round(y / gridSize) * gridSize;
    
    // 如果距离网格点足够近，则对齐到网格
    if (Math.abs(x - nearestGridX) <= gridThreshold) {
      snappedX = nearestGridX;
    }
    if (Math.abs(y - nearestGridY) <= gridThreshold) {
      snappedY = nearestGridY;
    }
    
    // 组件对齐（优先级高于网格对齐）
    guides.forEach(guide => {
      if (guide.type === 'vertical') {
        // 检查左边对齐
        if (Math.abs(x - guide.position) <= 5) {
          snappedX = guide.position;
        }
        // 检查右边对齐
        if (Math.abs((x + width) - guide.position) <= 5) {
          snappedX = guide.position - width;
        }
        // 检查中心对齐
        const centerX = x + width / 2;
        if (Math.abs(centerX - guide.position) <= 5) {
          snappedX = guide.position - width / 2;
        }
      } else {
        // 检查顶部对齐
        if (Math.abs(y - guide.position) <= 5) {
          snappedY = guide.position;
        }
        // 检查底部对齐
        if (Math.abs((y + height) - guide.position) <= 5) {
          snappedY = guide.position - height;
        }
        // 检查中心对齐
        const centerY = y + height / 2;
        if (Math.abs(centerY - guide.position) <= 5) {
          snappedY = guide.position - height / 2;
        }
      }
    });
    
    return { x: snappedX, y: snappedY };
  };

  // 模板相关功能函数
  const saveTemplate = () => {
    if (!templateName.trim()) {
      alert('请输入模板名称');
      return;
    }
    
    if (!currentTableId) {
      alert('请先选择一个数据表');
      return;
    }
    
    const newTemplate: Template = {
      id: `template_${Date.now()}`,
      name: templateName.trim(),
      tableId: currentTableId,
      components: JSON.parse(JSON.stringify(canvasComponents)), // 深拷贝当前组件配置
      createdAt: Date.now()
    };
    
    const updatedTemplates = [...templates, newTemplate];
    setTemplates(updatedTemplates);
    saveTemplatesToStorage(updatedTemplates);
    setTemplateName('');
    setShowSaveTemplateModal(false);
  };
  
  const loadTemplate = (template: Template) => {
    setCanvasComponents(JSON.parse(JSON.stringify(template.components))); // 深拷贝模板组件
    setCurrentTableId(template.tableId);
    setShowTemplateModal(false);
  };
  
  const deleteTemplate = (templateId: string) => {
    if (confirm('确定要删除这个模板吗？')) {
      const updatedTemplates = templates.filter(t => t.id !== templateId);
      setTemplates(updatedTemplates);
      saveTemplatesToStorage(updatedTemplates);
    }
  };
  
  const getCurrentTableTemplates = () => {
    return templates.filter(t => t.tableId === currentTableId);
  };

  const handlePrint = async () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const canvasElement = document.querySelector('.canvas') as HTMLElement;
    if (!canvasElement) return;
    
    const canvasRect = canvasElement.getBoundingClientRect();
    
    // 异步生成组件内容
    const componentContents = await Promise.all(canvasComponents.map(async component => {
      if (component.type === 'table' && component.tableFields && component.tableFields.length > 0 && component.selectedTableId) {
        // 多维表格组件在打印时显示完整表格数据
        const fieldsToShow = component.selectedFields && component.selectedFields.length > 0
          ? component.fieldOrder?.map(fieldId => 
              component.tableFields?.find(f => f.id === fieldId)
            ).filter(Boolean) || []
          : component.tableFields || [];
        
        if (fieldsToShow.length === 0) {
          return `
            <div class="print-component" style="
              left: ${component.x}px;
              top: ${component.y}px;
              width: ${component.width}px;
              height: ${component.height}px;
              font-size: ${component.fontSize || 18}px;
              color: ${component.color || '#000000'};
              font-weight: ${component.fontWeight || 'normal'};
              text-align: ${component.textAlign || 'center'};
              line-height: ${component.lineHeight || 1.5};
              border: 1px solid #333;
              background: #f9f9f9;
              display: flex;
              align-items: center;
              justify-content: center;
              border-radius: 4px;
            ">
              请选择要显示的字段
            </div>
          `;
        }
        
        // 根据打印模式获取表格记录数据
        const records = component.printMode === 'current' 
          ? await fetchCurrentViewRecords(component.selectedTableId)
          : await fetchTableRecords(component.selectedTableId);
        
        // 计算每列的内容最大长度（包括字段名和数据值）
        const columnContentLengths: number[] = [];
        
        // 如果需要显示序号列，添加序号列的内容长度
        if (component.showRowNumber) {
          // 序号列的最大长度（考虑"序号"标题和最大行号）
          const maxRowNumber = records.length;
          const rowNumberLength = Math.max(2, maxRowNumber.toString().length); // "序号"长度为2
          columnContentLengths.push(rowNumberLength);
        }
        
        // 添加字段列的内容长度
        fieldsToShow.forEach(field => {
          // 字段名长度
          let maxLength = field.name.length;
          
          // 遍历所有记录，找出该字段的最大内容长度
          records.forEach(record => {
            const fieldValue = record.fields[field.id];
            const displayValue = formatFieldValue(fieldValue, field.type);
            maxLength = Math.max(maxLength, displayValue.length);
          });
          
          columnContentLengths.push(maxLength);
        });
        
        // 计算列宽分配
        const totalContentLength = columnContentLengths.reduce((sum, length) => sum + length, 0);
        const minColumnWidthPx = 60; // 最小列宽像素
        const padding = 16; // 每列的内边距
        const totalColumns = fieldsToShow.length + (component.showRowNumber ? 1 : 0);
        const borderWidth = totalColumns + 1; // 边框宽度
        const availableWidthPx = component.width - borderWidth;
        
        // 计算每列的理想宽度（基于内容长度）
        const fontSize = Math.max(10, (component.fontSize || 18) - 2);
        const avgCharWidth = fontSize * 0.6; // 估算字符宽度
        
        const idealWidths = columnContentLengths.map(length => {
          return Math.max(minColumnWidthPx, (length * avgCharWidth) + padding);
        });
        
        const totalIdealWidth = idealWidths.reduce((sum, width) => sum + width, 0);
        
        // 如果理想宽度超过可用宽度，按比例缩放
        let columnWidths;
        if (totalIdealWidth > availableWidthPx) {
          const scaleFactor = availableWidthPx / totalIdealWidth;
          columnWidths = idealWidths.map(width => {
            const scaledWidth = width * scaleFactor;
            return Math.max(minColumnWidthPx, scaledWidth);
          });
        } else {
          // 如果有剩余空间，按比例分配
          const remainingWidth = availableWidthPx - totalIdealWidth;
          const totalWeight = columnContentLengths.reduce((sum, length) => sum + length, 0);
          
          columnWidths = idealWidths.map((width, index) => {
            if (totalWeight > 0) {
              const extraWidth = (columnContentLengths[index] / totalWeight) * remainingWidth;
              return width + extraWidth;
            }
            return width;
          });
        }
        
        // 转换为百分比
        const totalActualWidth = columnWidths.reduce((sum, width) => sum + width, 0);
        const columnWidthPercentages = columnWidths.map(width => (width / totalActualWidth) * 100);
        
        // 计算表格内容所需的最小高度（基于实际内容）
        const lineHeight = 1.4;
        const headerHeight = fontSize * lineHeight + 8; // 表头高度
        
        // 计算每行的实际高度需求
        const rowHeights = records.map(record => {
          let maxRowHeight = fontSize * lineHeight + 6; // 基础行高
          
          // 检查序号列（如果存在）
          if (component.showRowNumber) {
            const rowNumberWidth = columnWidths[0];
            const availableCellWidth = rowNumberWidth - padding;
            const charsPerLine = Math.max(1, Math.floor(availableCellWidth / avgCharWidth));
            const rowNumberText = (records.indexOf(record) + 1).toString();
            const linesNeeded = Math.ceil(rowNumberText.length / charsPerLine);
            const cellHeight = linesNeeded * fontSize * lineHeight + 6;
            maxRowHeight = Math.max(maxRowHeight, cellHeight);
          }
          
          // 检查字段列
          fieldsToShow.forEach((field, fieldIndex) => {
            const colIndex = fieldIndex + (component.showRowNumber ? 1 : 0);
            const fieldValue = record.fields[field.id];
            const displayValue = formatFieldValue(fieldValue, field.type);
            
            // 估算该单元格需要的行数
            const columnWidthPx = columnWidths[colIndex];
            const availableCellWidth = columnWidthPx - padding;
            const charsPerLine = Math.max(1, Math.floor(availableCellWidth / avgCharWidth));
            const linesNeeded = Math.ceil(displayValue.length / charsPerLine);
            const cellHeight = linesNeeded * fontSize * lineHeight + 6;
            
            maxRowHeight = Math.max(maxRowHeight, cellHeight);
          });
          
          return maxRowHeight;
        });
        
        const totalDataHeight = rowHeights.reduce((sum, height) => sum + height, 0);
        const tableHeight = Math.max(40, headerHeight + totalDataHeight + 10); // 最小40px高度，加10px边距
        
        return `
          <div style="
            position: absolute;
            left: ${component.x}px;
            top: ${component.y}px;
            width: ${component.width}px;
            height: ${tableHeight}px;
            background: #fff;
            border-radius: 4px;
            overflow: visible;
          ">
            <table style="
              width: 100%;
              height: 100%;
              border-collapse: collapse;
              font-size: ${component.fontSize || 18}px;
              color: ${component.color || '#000000'};
              font-weight: ${component.fontWeight || 'normal'};
              table-layout: fixed;
            ">
              <thead>
                <tr style="background-color: ${component.headerBackgroundColor || '#f5f5f5'}; height: ${headerHeight}px;">
                  ${(() => {
                    const headers = [];
                    
                    // 如果需要显示序号列，添加序号列表头
                    if (component.showRowNumber) {
                      headers.push(`
                        <th style="
                          width: ${columnWidthPercentages[0].toFixed(2)}%;
                          border: 1px solid #ddd;
                          padding: 4px 8px;
                          text-align: center;
                          vertical-align: middle;
                          word-wrap: break-word;
                          overflow-wrap: break-word;
                          hyphens: auto;
                          background-color: ${component.headerBackgroundColor || '#f5f5f5'};
                          font-size: ${fontSize}px;
                          line-height: ${lineHeight};
                          font-weight: ${component.headerFontWeight || 'bold'};
                        " title="序号">
                          序号
                        </th>
                      `);
                    }
                    
                    // 添加字段列表头
                    fieldsToShow.forEach((field, fieldIndex) => {
                      const colIndex = fieldIndex + (component.showRowNumber ? 1 : 0);
                      headers.push(`
                        <th style="
                          width: ${columnWidthPercentages[colIndex].toFixed(2)}%;
                          border: 1px solid #ddd;
                          padding: 4px 8px;
                          text-align: center;
                          vertical-align: middle;
                          word-wrap: break-word;
                          overflow-wrap: break-word;
                          hyphens: auto;
                          background-color: ${component.headerBackgroundColor || '#f5f5f5'};
                          font-size: ${fontSize}px;
                          line-height: ${lineHeight};
                          font-weight: ${component.headerFontWeight || 'bold'};
                        " title="${field.name}">
                          ${field.name}
                        </th>
                      `);
                    });
                    
                    return headers.join('');
                  })()}
                </tr>
              </thead>
              <tbody>
                ${records.map((record, rowIndex) => `
                  <tr style="height: ${rowHeights[rowIndex]}px;">
                    ${(() => {
                      const cells = [];
                      
                      // 如果需要显示序号列，添加序号列数据
                      if (component.showRowNumber) {
                        const rowNumber = rowIndex + 1;
                        cells.push(`
                          <td style="
                            width: ${columnWidthPercentages[0].toFixed(2)}%;
                            border: 1px solid #ddd;
                            padding: 4px 8px;
                            text-align: center;
                            vertical-align: top;
                            word-wrap: break-word;
                            overflow-wrap: break-word;
                            hyphens: auto;
                            background-color: #fff;
                            font-size: ${fontSize}px;
                            line-height: ${lineHeight};
                          " title="${rowNumber}">
                            ${rowNumber}
                          </td>
                        `);
                      }
                      
                      // 添加字段列数据
                      fieldsToShow.forEach((field, fieldIndex) => {
                        const colIndex = fieldIndex + (component.showRowNumber ? 1 : 0);
                        const fieldValue = record.fields[field.id];
                        const displayValue = formatFieldValue(fieldValue, field.type);
                        cells.push(`
                          <td style="
                            width: ${columnWidthPercentages[colIndex].toFixed(2)}%;
                            border: 1px solid #ddd;
                            padding: 4px 8px;
                            text-align: ${component.textAlign || 'left'};
                            vertical-align: top;
                            word-wrap: break-word;
                            overflow-wrap: break-word;
                            hyphens: auto;
                            background-color: #fff;
                            font-size: ${fontSize}px;
                            line-height: ${lineHeight};
                          " title="${displayValue}">
                            ${displayValue}
                          </td>
                        `);
                      });
                      
                      return cells.join('');
                    })()}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      } else if (component.type === 'grid') {
        // 新的表格组件打印逻辑
        const rows = component.gridRows || 3;
        const columns = component.gridColumns || 3;
        const cells = component.gridCells || {};
        
        let tableHTML = `
          <div style="
            position: absolute;
            left: ${component.x}px;
            top: ${component.y}px;
            width: ${component.width}px;
            height: ${component.height}px;
            background: #fff;
            border-radius: 4px;
            overflow: visible;
          ">
            <table style="
              width: 100%;
              height: 100%;
              border-collapse: collapse;
              font-size: ${component.fontSize || 14}px;
              color: ${component.color || '#000000'};
              font-weight: ${component.fontWeight || 'normal'};
              table-layout: fixed;
            ">
              <tbody>`;
        
        for (let row = 0; row < rows; row++) {
          const rowHeight = component.gridRowHeights?.[row] || (100 / rows);
          tableHTML += `<tr style="height: ${rowHeight}%;">`;
          for (let col = 0; col < columns; col++) {
            const cellKey = `${row}-${col}`;
            const cellContent = cells[cellKey];
            const columnWidth = component.gridColumnWidths?.[col] || (100 / columns);
            
            // 检查单元格是否被合并覆盖
            if (isCellCovered(component.gridMergedCells, row, col)) {
              continue; // 被合并覆盖的单元格不输出
            }
            
            // 检查是否是合并单元格的起始位置
            const mergeInfo = component.gridMergedCells?.[cellKey];
            const colspan = mergeInfo?.colspan || 1;
            const rowspan = mergeInfo?.rowspan || 1;
            
            let cellText = '/';
            
            if (cellContent && cellContent.length > 0) {
              // 取第一个组件作为显示内容
              const firstComponent = cellContent[0];
              // 使用getComponentDisplayValue函数获取正确的显示内容
              cellText = getComponentDisplayValue(firstComponent);
              
              // 如果是特殊组件标识，替换为合适的打印文本
              if (cellText === '__TABLE_COMPONENT__') {
                cellText = '多维表格';
              } else if (cellText === '__GRID_COMPONENT__') {
                cellText = '表格组件';
              }
            }
            
            tableHTML += `
              <td ${colspan > 1 ? `colspan="${colspan}"` : ''} ${rowspan > 1 ? `rowspan="${rowspan}"` : ''} style="
                width: ${columnWidth}%;
                border: 1px solid #ddd;
                padding: 8px;
                text-align: ${component.textAlign || 'center'};
                vertical-align: middle;
                word-wrap: break-word;
                overflow-wrap: break-word;
                background-color: #fff;
                font-size: ${component.fontSize || 14}px;
                line-height: ${component.lineHeight || 1.5};
              ">
                ${cellText}
              </td>
            `;
          }
          tableHTML += '</tr>';
        }
        
        tableHTML += `
              </tbody>
            </table>
          </div>
        `;
        
        return tableHTML;
      } else {
        // 其他组件使用原有逻辑
        return `
          <div class="print-component" style="
            left: ${component.x}px;
            top: ${component.y}px;
            width: ${component.width}px;
            height: ${component.height}px;
            font-size: ${component.fontSize || 18}px;
            color: ${component.color || '#000000'};
            font-weight: ${component.fontWeight || 'normal'};
            text-align: ${component.textAlign || 'left'};
            line-height: ${component.lineHeight || 1.5};
          ">
            ${getComponentDisplayValue(component)}
          </div>
        `;
      }
    }));
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>画布打印</title>
          <style>
            body {
              margin: 0;
              padding: 20px;
              font-family: Arial, sans-serif;
            }
            .print-canvas {
              position: relative;
              width: 900px;
              height: 1285px;
              border: 1px solid #ccc;
              background: white;
              margin: 0 auto;
            }
            .print-component {
              position: absolute;
              border: 1px solid #333;
              background: #f9f9f9;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 12px;
              border-radius: 4px;
            }
            @media print {
              body { margin: 0; padding: 0; }
              .print-canvas { border: none; }
              .print-component { border: none; }
            }
          </style>
        </head>
        <body>
          <div class="print-canvas">
            ${componentContents.join('')}
          </div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  return (
    <div className="app">
      <div className="layout-container">
        <div className="left-panel">
          <div className="left-panel-container">
            <div className="left-top-panel">
              <div className="panel-header">
                <h3 className="panel-title">组件</h3>
              </div>
              <FieldList />
            </div>
            <div className="left-bottom-panel">
              <div className="panel-header">
                <h3 className="panel-title">属性</h3>
              </div>
              <div className="properties-panel">
                {selectedComponent ? (
                  <div>
                    {(() => {
                      // 首先在画布组件中查找
                      let component = canvasComponents.find(c => c.id === selectedComponent);
                      
                      // 如果没找到，在表格单元格中查找
                      if (!component) {
                        for (const canvasComp of canvasComponents) {
                          if (canvasComp.type === 'grid' && canvasComp.gridCells) {
                            for (const cellComponents of Object.values(canvasComp.gridCells)) {
                              const foundComp = cellComponents.find(c => c.id === selectedComponent);
                              if (foundComp) {
                                component = foundComp;
                                break;
                              }
                            }
                            if (component) break;
                          }
                        }
                      }
                      
                      if (!component) return null;
                      
                      return (
                        <div>
                          {/* 文本内容设置 - 只有文本组件才显示 */}
                          {component.type === 'text' && (
                            <div className="property-section">
                              <label>文本内容:</label>
                              <textarea
                                value={component.textContent || ''}
                                onChange={(e) => {
                                  // 更新组件属性的通用函数
                                  const updateComponent = (updates: any) => {
                                    setCanvasComponents(prev => prev.map(canvasComp => {
                                      // 如果是画布上的组件
                                      if (canvasComp.id === selectedComponent) {
                                        return { ...canvasComp, ...updates };
                                      }
                                      // 如果是表格单元格中的组件
                                      if (canvasComp.type === 'grid' && canvasComp.gridCells) {
                                        const updatedGridCells = { ...canvasComp.gridCells };
                                        let hasUpdate = false;
                                        
                                        for (const [cellKey, cellComponents] of Object.entries(updatedGridCells)) {
                                          const updatedCellComponents = cellComponents.map(cellComp => {
                                            if (cellComp.id === selectedComponent) {
                                              hasUpdate = true;
                                              return { ...cellComp, ...updates };
                                            }
                                            return cellComp;
                                          });
                                          updatedGridCells[cellKey] = updatedCellComponents;
                                        }
                                        
                                        if (hasUpdate) {
                                          return { ...canvasComp, gridCells: updatedGridCells };
                                        }
                                      }
                                      return canvasComp;
                                    }));
                                  };
                                  
                                  updateComponent({ textContent: e.target.value });
                                  
                                  // 异步调整组件高度
                                  setTimeout(() => {
                                    autoAdjustComponentHeight(selectedComponent);
                                  }, 0);
                                }}
                                placeholder="请输入文本内容"
                                rows={3}
                                style={{
                                  width: '100%',
                                  resize: 'vertical',
                                  minHeight: '60px'
                                }}
                              />
                            </div>
                          )}
                          
                          {/* 多维表格组件的数据表选择 */}
                          {component.type === 'table' && (
                            <div className="property-section">
                              <label>选择数据表:</label>
                              <select
                                value={component.selectedTableId || ''}
                                onChange={async (e) => {
                                  const tableId = e.target.value;
                                  let tableFields: any[] = [];
                                  
                                  if (tableId) {
                                    tableFields = await fetchTableFields(tableId);
                                  }
                                  
                                  // 更新组件属性的通用函数
                                  const updateComponent = (updates: any) => {
                                    setCanvasComponents(prev => prev.map(canvasComp => {
                                      // 如果是画布上的组件
                                      if (canvasComp.id === selectedComponent) {
                                        return { ...canvasComp, ...updates };
                                      }
                                      // 如果是表格单元格中的组件
                                      if (canvasComp.type === 'grid' && canvasComp.gridCells) {
                                        const updatedGridCells = { ...canvasComp.gridCells };
                                        let hasUpdate = false;
                                        
                                        for (const [cellKey, cellComponents] of Object.entries(updatedGridCells)) {
                                          const updatedCellComponents = cellComponents.map(cellComp => {
                                            if (cellComp.id === selectedComponent) {
                                              hasUpdate = true;
                                              return { ...cellComp, ...updates };
                                            }
                                            return cellComp;
                                          });
                                          updatedGridCells[cellKey] = updatedCellComponents;
                                        }
                                        
                                        if (hasUpdate) {
                                          return { ...canvasComp, gridCells: updatedGridCells };
                                        }
                                      }
                                      return canvasComp;
                                    }));
                                  };
                                  
                                  updateComponent({ selectedTableId: tableId, tableFields });
                                  
                                  // 异步调整组件高度
                                  setTimeout(() => {
                                    autoAdjustComponentHeight(selectedComponent);
                                  }, 0);
                                }}
                                style={{ width: '100%' }}
                              >
                                <option value="">请选择数据表</option>
                                {allTables.map(table => (
                                  <option key={table.id} value={table.id}>
                                    {table.name}
                                  </option>
                                ))}
                              </select>
                              {isLoadingTables && (
                                <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                                  加载数据表中...
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* 多维表格组件的字段选择和排序 - 卡片形式 */}
                          {component.type === 'table' && component.tableFields && component.tableFields.length > 0 && (
                            <div className="property-section">
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <label>字段选择与排序:</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const allFieldIds = component.tableFields?.map(f => f.id) || [];
                                      
                                      // 更新组件属性的通用函数
                                      const updateComponent = (updates: any) => {
                                        setCanvasComponents(prev => prev.map(canvasComp => {
                                          // 如果是画布上的组件
                                          if (canvasComp.id === selectedComponent) {
                                            return { ...canvasComp, ...updates };
                                          }
                                          // 如果是表格单元格中的组件
                                          if (canvasComp.type === 'grid' && canvasComp.gridCells) {
                                            const updatedGridCells = { ...canvasComp.gridCells };
                                            let hasUpdate = false;
                                            
                                            for (const [cellKey, cellComponents] of Object.entries(updatedGridCells)) {
                                              const updatedCellComponents = cellComponents.map(cellComp => {
                                                if (cellComp.id === selectedComponent) {
                                                  hasUpdate = true;
                                                  return { ...cellComp, ...updates };
                                                }
                                                return cellComp;
                                              });
                                              updatedGridCells[cellKey] = updatedCellComponents;
                                            }
                                            
                                            if (hasUpdate) {
                                              return { ...canvasComp, gridCells: updatedGridCells };
                                            }
                                          }
                                          return canvasComp;
                                        }));
                                      };
                                      
                                      updateComponent({ 
                                        selectedFields: allFieldIds,
                                        fieldOrder: allFieldIds
                                      });
                                      
                                      setTimeout(() => {
                                        autoAdjustComponentHeight(selectedComponent);
                                      }, 0);
                                    }}
                                    style={{
                                      padding: '4px 8px',
                                      fontSize: '11px',
                                      border: '1px solid #007bff',
                                      borderRadius: '4px',
                                      background: '#007bff',
                                      color: '#fff',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    全选
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      // 更新组件属性的通用函数
                                      const updateComponent = (updates: any) => {
                                        setCanvasComponents(prev => prev.map(canvasComp => {
                                          // 如果是画布上的组件
                                          if (canvasComp.id === selectedComponent) {
                                            return { ...canvasComp, ...updates };
                                          }
                                          // 如果是表格单元格中的组件
                                          if (canvasComp.type === 'grid' && canvasComp.gridCells) {
                                            const updatedGridCells = { ...canvasComp.gridCells };
                                            let hasUpdate = false;
                                            
                                            for (const [cellKey, cellComponents] of Object.entries(updatedGridCells)) {
                                              const updatedCellComponents = cellComponents.map(cellComp => {
                                                if (cellComp.id === selectedComponent) {
                                                  hasUpdate = true;
                                                  return { ...cellComp, ...updates };
                                                }
                                                return cellComp;
                                              });
                                              updatedGridCells[cellKey] = updatedCellComponents;
                                            }
                                            
                                            if (hasUpdate) {
                                              return { ...canvasComp, gridCells: updatedGridCells };
                                            }
                                          }
                                          return canvasComp;
                                        }));
                                      };
                                      
                                      updateComponent({ 
                                        selectedFields: [],
                                        fieldOrder: []
                                      });
                                      
                                      setTimeout(() => {
                                        autoAdjustComponentHeight(selectedComponent);
                                      }, 0);
                                    }}
                                    style={{
                                      padding: '4px 8px',
                                      fontSize: '11px',
                                      border: '1px solid #6c757d',
                                      borderRadius: '4px',
                                      background: '#6c757d',
                                      color: '#fff',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    清空
                                  </button>
                                </div>
                              </div>
                              
                              {/* 字段卡片列表 */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {component.tableFields.map((field, index) => {
                                  const isSelected = component.selectedFields?.includes(field.id) || false;
                                  const selectedIndex = component.fieldOrder?.indexOf(field.id) ?? -1;
                                  
                                  return (
                                    <div
                                      key={field.id || index}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '12px',
                                        borderRadius: '8px',
                                        border: isSelected ? '2px solid #007bff' : '2px solid #e9ecef',
                                        backgroundColor: isSelected ? '#f8f9ff' : '#fff',
                                        cursor: isSelected ? 'move' : 'pointer',
                                        transition: 'all 0.2s ease',
                                        boxShadow: isSelected ? '0 2px 8px rgba(0,123,255,0.15)' : '0 1px 3px rgba(0,0,0,0.1)',
                                        transform: isSelected ? 'translateY(-1px)' : 'none'
                                      }}
                                      onClick={() => {
                                        const fieldId = field.id;
                                        const isCurrentlySelected = component.selectedFields?.includes(fieldId) || false;
                                        
                                        const currentSelected = component.selectedFields || [];
                                        const currentOrder = component.fieldOrder || [];
                                        
                                        let newSelectedFields;
                                        let newFieldOrder;
                                        
                                        if (!isCurrentlySelected) {
                                          // 添加字段
                                          newSelectedFields = [...currentSelected, fieldId];
                                          newFieldOrder = [...currentOrder, fieldId];
                                        } else {
                                          // 移除字段
                                          newSelectedFields = currentSelected.filter(id => id !== fieldId);
                                          newFieldOrder = currentOrder.filter(id => id !== fieldId);
                                        }
                                        
                                        // 更新组件属性的通用函数
                                        const updateComponent = (updates: any) => {
                                          setCanvasComponents(prev => prev.map(canvasComp => {
                                            // 如果是画布上的组件
                                            if (canvasComp.id === selectedComponent) {
                                              return { ...canvasComp, ...updates };
                                            }
                                            // 如果是表格单元格中的组件
                                            if (canvasComp.type === 'grid' && canvasComp.gridCells) {
                                              const updatedGridCells = { ...canvasComp.gridCells };
                                              let hasUpdate = false;
                                              
                                              for (const [cellKey, cellComponents] of Object.entries(updatedGridCells)) {
                                                const updatedCellComponents = cellComponents.map(cellComp => {
                                                  if (cellComp.id === selectedComponent) {
                                                    hasUpdate = true;
                                                    return { ...cellComp, ...updates };
                                                  }
                                                  return cellComp;
                                                });
                                                updatedGridCells[cellKey] = updatedCellComponents;
                                              }
                                              
                                              if (hasUpdate) {
                                                return { ...canvasComp, gridCells: updatedGridCells };
                                              }
                                            }
                                            return canvasComp;
                                          }));
                                        };
                                        
                                        updateComponent({
                                          selectedFields: newSelectedFields,
                                          fieldOrder: newFieldOrder
                                        });
                                        
                                        // 异步调整组件高度
                                        setTimeout(() => {
                                          autoAdjustComponentHeight(selectedComponent);
                                        }, 0);
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                                        {isSelected && (
                                          <div style={{
                                            width: '20px',
                                            height: '20px',
                                            borderRadius: '50%',
                                            backgroundColor: '#007bff',
                                            color: '#fff',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '12px',
                                            fontWeight: 'bold',
                                            marginRight: '12px',
                                            minWidth: '20px'
                                          }}>
                                            {selectedIndex + 1}
                                          </div>
                                        )}
                                        <div style={{ flex: 1 }}>
                                          <div style={{ 
                                            fontSize: '14px', 
                                            fontWeight: isSelected ? '600' : '400',
                                            color: isSelected ? '#007bff' : '#333'
                                          }}>
                                            {field.name}
                                          </div>
                                        </div>
                                      </div>
                                      
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{
                                          width: '18px',
                                          height: '18px',
                                          borderRadius: '3px',
                                          border: isSelected ? '2px solid #007bff' : '2px solid #ddd',
                                          backgroundColor: isSelected ? '#007bff' : '#fff',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          transition: 'all 0.2s ease'
                                        }}>
                                          {isSelected && (
                                            <div style={{ color: '#fff', fontSize: '12px', lineHeight: 1 }}>✓</div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              
                              {component.selectedFields && component.selectedFields.length > 0 && (
                                <div style={{
                                  marginTop: '12px',
                                  padding: '8px 12px',
                                  backgroundColor: '#e7f3ff',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  color: '#0066cc'
                                }}>
                                  已选择 {component.selectedFields.length} 个字段
                                </div>
                              )}
                            </div>
                          )}
                           
                           <div className="property-section">
                            <label>文字大小:</label>
                            <input
                              type="number"
                              min="8"
                              max="72"
                              value={component.fontSize || 18}
                              onChange={(e) => {
                                const newFontSize = parseInt(e.target.value);
                                setCanvasComponents(prev => prev.map(c => 
                                  c.id === selectedComponent 
                                    ? { ...c, fontSize: newFontSize }
                                    : c
                                ));
                                // 异步调整组件高度
                                setTimeout(() => {
                                  autoAdjustComponentHeight(selectedComponent);
                                }, 0);
                              }}
                            />
                          </div>
                          
                          <div className="property-section">
                            <label>文字颜色:</label>
                            <input
                              type="color"
                              value={component.color || '#000000'}
                              onChange={(e) => {
                                setCanvasComponents(prev => prev.map(c => 
                                  c.id === selectedComponent 
                                    ? { ...c, color: e.target.value }
                                    : c
                                ));
                              }}
                            />
                          </div>
                          
                          <div className="property-section">
                            <label>字重:</label>
                            <select
                              value={component.fontWeight || 'normal'}
                              onChange={(e) => {
                                setCanvasComponents(prev => prev.map(c => 
                                  c.id === selectedComponent 
                                    ? { ...c, fontWeight: e.target.value as 'normal' | 'bold' }
                                    : c
                                ));
                              }}
                            >
                              <option value="normal">正常</option>
                              <option value="bold">粗体</option>
                            </select>
                          </div>
                          
                          <div className="property-section">
                            <label>对齐方式:</label>
                            <select
                              value={component.textAlign || 'left'}
                              onChange={(e) => {
                                setCanvasComponents(prev => prev.map(c => 
                                  c.id === selectedComponent 
                                    ? { ...c, textAlign: e.target.value as 'left' | 'center' | 'right' }
                                    : c
                                ));
                              }}
                            >
                              <option value="left">左对齐</option>
                              <option value="center">居中</option>
                              <option value="right">右对齐</option>
                            </select>
                          </div>
                          
                          <div className="property-section">
                            <label>行距:</label>
                            <input
                              type="number"
                              min="1"
                              max="3"
                              step="0.1"
                              value={component.lineHeight || 1.5}
                              onChange={(e) => {
                                const newLineHeight = parseFloat(e.target.value);
                                setCanvasComponents(prev => prev.map(c => 
                                  c.id === selectedComponent 
                                    ? { ...c, lineHeight: newLineHeight }
                                    : c
                                ));
                                // 异步调整组件高度
                                setTimeout(() => {
                                  autoAdjustComponentHeight(selectedComponent);
                                }, 0);
                              }}
                            />
                          </div>
                          
                          {/* 表格组件专用的行列数配置 */}
                          {component.type === 'grid' && (
                            <>
                              <div className="property-section">
                                <label>表格行数:</label>
                                <input
                                  type="number"
                                  min="1"
                                  max="20"
                                  value={component.gridRows || 3}
                                  onChange={(e) => {
                                    const newRows = parseInt(e.target.value) || 1;
                                    const currentRows = component.gridRows || 3;
                                    let newRowHeights = component.gridRowHeights || Array(currentRows).fill(100 / currentRows);
                                    
                                    // 调整行高数组
                                    if (newRows > currentRows) {
                                      // 增加行数，新行使用平均高度
                                      const averageHeight = 100 / newRows;
                                      newRowHeights = Array(newRows).fill(averageHeight);
                                    } else if (newRows < currentRows) {
                                      // 减少行数，保留前面的行并重新分配高度
                                      newRowHeights = newRowHeights.slice(0, newRows);
                                      const totalHeight = newRowHeights.reduce((sum, h) => sum + h, 0);
                                      if (totalHeight !== 100) {
                                        const factor = 100 / totalHeight;
                                        newRowHeights = newRowHeights.map(h => h * factor);
                                      }
                                    }
                                    
                                    setCanvasComponents(prev => prev.map(c => 
                                      c.id === selectedComponent 
                                        ? { ...c, gridRows: newRows, gridRowHeights: newRowHeights }
                                        : c
                                    ));
                                  }}
                                />
                              </div>
                              
                              <div className="property-section">
                                <label>表格列数:</label>
                                <input
                                  type="number"
                                  min="1"
                                  max="20"
                                  value={component.gridColumns || 3}
                                  onChange={(e) => {
                                    const newColumns = parseInt(e.target.value) || 1;
                                    const currentColumns = component.gridColumns || 3;
                                    let newColumnWidths = component.gridColumnWidths || Array(currentColumns).fill(100 / currentColumns);
                                    
                                    // 调整列宽数组
                                    if (newColumns > currentColumns) {
                                      // 增加列数，新列使用平均宽度
                                      const averageWidth = 100 / newColumns;
                                      newColumnWidths = Array(newColumns).fill(averageWidth);
                                    } else if (newColumns < currentColumns) {
                                      // 减少列数，保留前面的列并重新分配宽度
                                      newColumnWidths = newColumnWidths.slice(0, newColumns);
                                      const totalWidth = newColumnWidths.reduce((sum, w) => sum + w, 0);
                                      if (totalWidth !== 100) {
                                        const factor = 100 / totalWidth;
                                        newColumnWidths = newColumnWidths.map(w => w * factor);
                                      }
                                    }
                                    
                                    setCanvasComponents(prev => prev.map(c => 
                                      c.id === selectedComponent 
                                        ? { ...c, gridColumns: newColumns, gridColumnWidths: newColumnWidths }
                                        : c
                                    ));
                                  }}
                                />
                              </div>
                            </>
                          )}
                          
                          {/* 多维表格组件专用的表头样式配置 */}
                          {component.type === 'table' && (
                            <>
                              <div className="property-section">
                                <label>表头背景颜色:</label>
                                <input
                                  type="color"
                                  value={component.headerBackgroundColor || '#f5f5f5'}
                                  onChange={(e) => {
                                    setCanvasComponents(prev => prev.map(c => 
                                      c.id === selectedComponent 
                                        ? { ...c, headerBackgroundColor: e.target.value }
                                        : c
                                    ));
                                  }}
                                />
                              </div>
                              
                              <div className="property-section">
                                <label>表头文字加粗:</label>
                                <select
                                  value={component.headerFontWeight || 'bold'}
                                  onChange={(e) => {
                                    setCanvasComponents(prev => prev.map(c => 
                                      c.id === selectedComponent 
                                        ? { ...c, headerFontWeight: e.target.value as 'normal' | 'bold' }
                                        : c
                                    ));
                                  }}
                                >
                                  <option value="normal">正常</option>
                                  <option value="bold">粗体</option>
                                </select>
                              </div>
                              
                              <div className="property-section">
                                <label>打印模式:</label>
                                <select
                                  value={component.printMode || 'all'}
                                  onChange={(e) => {
                                    setCanvasComponents(prev => prev.map(c => 
                                      c.id === selectedComponent 
                                        ? { ...c, printMode: e.target.value as 'all' | 'current' }
                                        : c
                                    ));
                                  }}
                                >
                                  <option value="all">打印全部数据</option>
                                  <option value="current">打印当前视图数据</option>
                                </select>
                              </div>
                              
                              <div className="property-section">
                                <label>显示序号列:</label>
                                <select
                                  value={component.showRowNumber ? 'true' : 'false'}
                                  onChange={(e) => {
                                    setCanvasComponents(prev => prev.map(c => 
                                      c.id === selectedComponent 
                                        ? { ...c, showRowNumber: e.target.value === 'true' }
                                        : c
                                    ));
                                  }}
                                >
                                  <option value="true">是</option>
                                  <option value="false">否</option>
                                </select>
                              </div>
                            </>
                          )}
                          
                          {/* 表格组件的单元格合并控制 */}
                          {component.type === 'grid' && (
                            <>
                              <div className="property-section">
                                <label>单元格合并控制:</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <label style={{ fontSize: '12px', minWidth: '60px' }}>起始行:</label>
                                    <input
                                      type="number"
                                      min="0"
                                      max={(component.gridRows || 3) - 1}
                                      value={mergeStartRow}
                                      onChange={(e) => setMergeStartRow(parseInt(e.target.value) || 0)}
                                      style={{ width: '60px', fontSize: '12px' }}
                                    />
                                    <label style={{ fontSize: '12px', minWidth: '60px' }}>起始列:</label>
                                    <input
                                      type="number"
                                      min="0"
                                      max={(component.gridColumns || 3) - 1}
                                      value={mergeStartCol}
                                      onChange={(e) => setMergeStartCol(parseInt(e.target.value) || 0)}
                                      style={{ width: '60px', fontSize: '12px' }}
                                    />
                                  </div>
                                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <label style={{ fontSize: '12px', minWidth: '60px' }}>结束行:</label>
                                    <input
                                      type="number"
                                      min="0"
                                      max={(component.gridRows || 3) - 1}
                                      value={mergeEndRow}
                                      onChange={(e) => setMergeEndRow(parseInt(e.target.value) || 0)}
                                      style={{ width: '60px', fontSize: '12px' }}
                                    />
                                    <label style={{ fontSize: '12px', minWidth: '60px' }}>结束列:</label>
                                    <input
                                      type="number"
                                      min="0"
                                      max={(component.gridColumns || 3) - 1}
                                      value={mergeEndCol}
                                      onChange={(e) => setMergeEndCol(parseInt(e.target.value) || 0)}
                                      style={{ width: '60px', fontSize: '12px' }}
                                    />
                                  </div>
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                      onClick={() => {
                                        const updatedComponent = mergeCells(component, mergeStartRow, mergeStartCol, mergeEndRow, mergeEndCol);
                                        setCanvasComponents(prev => prev.map(c => 
                                          c.id === selectedComponent ? updatedComponent : c
                                        ));
                                      }}
                                      style={{
                                        padding: '4px 8px',
                                        fontSize: '12px',
                                        backgroundColor: '#007bff',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      合并单元格
                                    </button>
                                    <button
                                      onClick={() => {
                                        const updatedComponent = splitCell(component, mergeStartRow, mergeStartCol);
                                        setCanvasComponents(prev => prev.map(c => 
                                          c.id === selectedComponent ? updatedComponent : c
                                        ));
                                      }}
                                      style={{
                                        padding: '4px 8px',
                                        fontSize: '12px',
                                        backgroundColor: '#dc3545',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      拆分单元格
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="property-section">
                    <p className="no-selection">请选择一个组件</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="right-panel">
          <div className="right-panel-container">
            <div className="panel-header">
              <h3 className="panel-title">排版</h3>
              <div className="header-buttons">
                <button 
                  className="select-template-button"
                  onClick={() => setShowTemplateModal(true)}
                  title="选择模板"
                >
                  📄 选择模板
                </button>
                <button 
                  className="save-template-button"
                  onClick={() => setShowSaveTemplateModal(true)}
                  title="保存为模板"
                >
                  💾 保存为模板
                </button>
                <button 
                  className="select-record-button"
                  onClick={() => {
              setShowRecordModal(true);
              setCurrentPage(1); // 重置到第一页
              fetchTableData();
            }}
                  title="选择记录"
                >
                  📋 选择记录
                </button>
                <button 
                  className="print-button"
                  onClick={handlePrint}
                  title="打印画布"
                >
                  🖨️ 打印
                </button>
              </div>
            </div>
            <div className="panel-content">
              <div className="canvas-container">
                <div 
                  className="canvas"
                  onDrop={handleCanvasDrop}
                  onDragOver={handleCanvasDragOver}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onClick={(e) => {
                    if (e.target === e.currentTarget) {
                      setSelectedComponent(null);
                    }
                  }}
                >
                  {canvasComponents.map((component) => (
                    <div
                      key={component.id}
                      className="canvas-component"
                      style={{
                        position: 'absolute',
                        left: component.x,
                        top: component.y,
                        width: component.width,
                        height: component.height,
                        border: selectedComponent === component.id ? '2px solid #007bff' : (draggedComponent === component.id || resizingComponent === component.id ? '2px solid #007bff' : '1px solid #ccc'),
                        backgroundColor: '#f9f9f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: component.textAlign === 'center' ? 'center' : component.textAlign === 'right' ? 'flex-end' : 'flex-start',
                        cursor: 'move',
                        fontSize: `${component.fontSize || 18}px`,
                        color: component.color || '#000000',
                        fontWeight: component.fontWeight || 'normal',
                        lineHeight: component.lineHeight || 1.5,
                        borderRadius: '4px',
                        zIndex: draggedComponent === component.id || resizingComponent === component.id ? 1000 : 1
                      }}
                      onMouseDown={(e) => handleComponentMouseDown(e, component.id)}
                    >
                      {component.type === 'table' && component.tableFields && component.tableFields.length > 0 ? (
                        <div 
                          style={{
                            width: '100%',
                            height: '100%',
                            overflowX: 'auto',
                            overflowY: 'hidden'
                          }}
                        >
                          <table 
                            style={{
                              width: 'max-content',
                              minWidth: '100%',
                              height: '100%',
                              borderCollapse: 'collapse',
                              fontSize: 'inherit',
                              color: 'inherit',
                              fontWeight: 'inherit'
                            }}
                          >
                            <tbody>
                               <tr style={{ height: '100%' }}>
                                  {(() => {
                                    // 获取要显示的字段列表，按照用户设置的顺序
                                    const fieldsToShow = component.selectedFields && component.selectedFields.length > 0
                                      ? component.fieldOrder?.map(fieldId => 
                                          component.tableFields?.find(f => f.id === fieldId)
                                        ).filter(Boolean) || []
                                      : component.tableFields || [];
                                    
                                    if (fieldsToShow.length === 0) {
                                      return (
                                        <td style={{
                                          width: '100%',
                                          border: '1px solid #ddd',
                                          padding: '8px 12px',
                                          textAlign: 'center',
                                          verticalAlign: 'middle',
                                          backgroundColor: '#fff',
                                          color: '#666',
                                          fontStyle: 'italic'
                                        }}>
                                          请选择要显示的字段
                                        </td>
                                      );
                                    }
                                    
                                    // 计算总列数（包括序号列）
                                    const totalColumns = fieldsToShow.length + (component.showRowNumber ? 1 : 0);
                                    const columnWidth = `${100 / totalColumns}%`;
                                    
                                    const columns = [];
                                    
                                    // 如果需要显示序号列，添加序号列
                                    if (component.showRowNumber) {
                                      columns.push(
                                        <td
                                          key="row-number"
                                          style={{
                                            width: columnWidth,
                                            border: '1px solid #ddd',
                                            padding: '8px 12px',
                                            textAlign: 'center',
                                            verticalAlign: 'middle',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            backgroundColor: component.headerBackgroundColor || '#f5f5f5',
                                            fontWeight: component.headerFontWeight || 'bold'
                                          }}
                                          title="序号"
                                        >
                                          序号
                                        </td>
                                      );
                                    }
                                    
                                    // 添加字段列
                                    fieldsToShow.forEach((field, index) => {
                                      columns.push(
                                        <td
                                          key={field.id || index}
                                          style={{
                                            width: columnWidth,
                                            border: '1px solid #ddd',
                                            padding: '8px 12px',
                                            textAlign: component.textAlign || 'center',
                                            verticalAlign: 'middle',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            backgroundColor: component.headerBackgroundColor || '#f5f5f5',
                                            fontWeight: component.headerFontWeight || 'bold'
                                          }}
                                          title={field.name}
                                        >
                                          {field.name}
                                        </td>
                                      );
                                    });
                                    
                                    return columns;
                                  })()}
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      ) : component.type === 'grid' ? (
                        <div 
                          style={{
                            width: '100%',
                            height: '100%',
                            overflow: 'hidden'
                          }}
                        >
                          <table 
                            style={{
                              width: '100%',
                              height: '100%',
                              borderCollapse: 'collapse',
                              fontSize: 'inherit',
                              color: 'inherit',
                              fontWeight: 'inherit'
                            }}
                          >
                            <tbody>
                              {Array.from({ length: component.gridRows || 3 }, (_, rowIndex) => {
                                const rowHeight = component.gridRowHeights?.[rowIndex] || (100 / (component.gridRows || 3));
                                return (
                                <tr key={rowIndex} style={{ height: `${rowHeight}%` }}>
                                  {Array.from({ length: component.gridColumns || 3 }, (_, colIndex) => {
                                    const cellKey = `${rowIndex}-${colIndex}`;
                                    const cellComponents = component.gridCells?.[cellKey] || [];
                                    const columnWidth = component.gridColumnWidths?.[colIndex] || (100 / (component.gridColumns || 3));
                                    
                                    // 检查单元格是否被合并覆盖
                                    if (isCellCovered(component.gridMergedCells, rowIndex, colIndex)) {
                                      return null; // 被合并覆盖的单元格不渲染
                                    }
                                    
                                    // 检查是否是合并单元格的起始位置
                                    const mergeInfo = component.gridMergedCells?.[cellKey];
                                    const colspan = mergeInfo?.colspan || 1;
                                    const rowspan = mergeInfo?.rowspan || 1;
                                    
                                    return (
                                      <td
                                        key={colIndex}
                                        colSpan={colspan}
                                        rowSpan={rowspan}
                                        style={{
                                          width: `${columnWidth}%`,
                                          border: '1px solid #ddd',
                                          padding: '4px',
                                          textAlign: 'center',
                                          verticalAlign: 'middle',
                                          backgroundColor: '#fff',
                                          position: 'relative'
                                        }}
                                        onDragOver={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          e.dataTransfer.dropEffect = 'copy';
                                          e.currentTarget.style.backgroundColor = '#e3f2fd';
                                        }}
                                        onDragLeave={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          e.currentTarget.style.backgroundColor = '#fff';
                                        }}
                                        onDrop={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          e.currentTarget.style.backgroundColor = '#fff';
                                          
                                          try {
                                            const fieldData = JSON.parse(e.dataTransfer.getData('application/json'));
                                            const cellKey = `${rowIndex}-${colIndex}`;
                                            
                                            // 创建新的组件对象
                                            const newCellComponent: CanvasComponent = {
                                              id: `${fieldData.id}_${Date.now()}`,
                                              name: fieldData.name,
                                              type: fieldData.type,
                                              x: 0,
                                              y: 0,
                                              width: 100,
                                              height: 20,
                                              ...(fieldData.type === 'text' && { textContent: fieldData.name })
                                            };
                                            
                                            // 更新表格组件的单元格内容
                                            setCanvasComponents(prev => prev.map(c => {
                                              if (c.id === component.id) {
                                                const updatedGridCells = { ...c.gridCells };
                                                // 如果单元格已有组件，替换第一个组件；否则添加新组件
                                                if (!updatedGridCells[cellKey]) {
                                                  updatedGridCells[cellKey] = [];
                                                }
                                                
                                                // 如果单元格为空，直接添加；如果有组件，替换第一个
                                                if (updatedGridCells[cellKey].length === 0) {
                                                  updatedGridCells[cellKey] = [newCellComponent];
                                                } else {
                                                  // 替换第一个组件，保留其他组件
                                                  updatedGridCells[cellKey] = [newCellComponent, ...updatedGridCells[cellKey].slice(1)];
                                                }
                                                
                                                return { ...c, gridCells: updatedGridCells };
                                              }
                                              return c;
                                            }));
                                          } catch (error) {
                                            console.error('处理单元格拖拽数据失败:', error);
                                          }
                                        }}
                                      >
                                        {cellComponents.length > 0 ? (
                                          cellComponents.map(cellComp => (
                                            <div 
                                              key={cellComp.id} 
                                              style={{ 
                                                fontSize: '12px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                gap: '4px',
                                                padding: '2px',
                                                borderRadius: '2px',
                                                backgroundColor: '#f8f9fa',
                                                margin: '1px 0'
                                              }}
                                            >
                                              <span 
                                                style={{ 
                                                  flex: 1, 
                                                  overflow: 'hidden', 
                                                  textOverflow: 'ellipsis',
                                                  cursor: 'pointer',
                                                  padding: '2px 4px',
                                                  borderRadius: '2px',
                                                  backgroundColor: selectedComponent === cellComp.id ? '#e6f3ff' : 'transparent',
                                                  border: selectedComponent === cellComp.id ? '1px solid #1890ff' : '1px solid transparent'
                                                }}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  // 选中单元格中的组件
                                                  setSelectedComponent(cellComp.id);
                                                }}
                                                title="点击选中组件"
                                              >
                                                {getComponentDisplayValue(cellComp)}
                                              </span>
                                              <button
                                                style={{
                                                  background: '#ff4d4f',
                                                  color: 'white',
                                                  border: 'none',
                                                  borderRadius: '2px',
                                                  width: '16px',
                                                  height: '16px',
                                                  fontSize: '10px',
                                                  cursor: 'pointer',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'center',
                                                  flexShrink: 0
                                                }}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  // 删除单元格中的组件
                                                  setCanvasComponents(prev => prev.map(c => {
                                                    if (c.id === component.id) {
                                                      const updatedGridCells = { ...c.gridCells };
                                                      if (updatedGridCells[cellKey]) {
                                                        updatedGridCells[cellKey] = updatedGridCells[cellKey].filter(
                                                          comp => comp.id !== cellComp.id
                                                        );
                                                        // 如果单元格为空，删除该键
                                                        if (updatedGridCells[cellKey].length === 0) {
                                                          delete updatedGridCells[cellKey];
                                                        }
                                                      }
                                                      return { ...c, gridCells: updatedGridCells };
                                                    }
                                                    return c;
                                                  }));
                                                }}
                                                title="删除组件"
                                              >
                                                ×
                                              </button>
                                            </div>
                                          ))
                                        ) : (
                                          <span style={{ color: '#ccc', fontSize: '12px' }}>/</span>
                                        )}
                                        
                                        {/* 列宽调整手柄 - 只在非最后一列显示 */}
                                        {colIndex < (component.gridColumns || 3) - 1 && (
                                          <div
                                            style={{
                                              position: 'absolute',
                                              top: 0,
                                              right: '-2px',
                                              width: '4px',
                                              height: '100%',
                                              cursor: 'col-resize',
                                              backgroundColor: 'transparent',
                                              zIndex: 10
                                            }}
                                            onMouseDown={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              
                                              const startX = e.clientX;
                                              const tableRect = e.currentTarget.closest('table')?.getBoundingClientRect();
                                              if (!tableRect) return;
                                              
                                              const currentWidths = component.gridColumnWidths || 
                                                Array(component.gridColumns || 3).fill(100 / (component.gridColumns || 3));
                                              
                                              const handleMouseMove = (moveEvent: MouseEvent) => {
                                                const deltaX = moveEvent.clientX - startX;
                                                const deltaPercent = (deltaX / tableRect.width) * 100;
                                                
                                                const newWidths = [...currentWidths];
                                                const minWidth = 5; // 最小宽度5%
                                                
                                                // 调整当前列和下一列的宽度
                                                if (newWidths[colIndex] + deltaPercent >= minWidth && 
                                                    newWidths[colIndex + 1] - deltaPercent >= minWidth) {
                                                  newWidths[colIndex] += deltaPercent;
                                                  newWidths[colIndex + 1] -= deltaPercent;
                                                  
                                                  setCanvasComponents(prev => prev.map(c => 
                                                    c.id === component.id 
                                                      ? { ...c, gridColumnWidths: newWidths }
                                                      : c
                                                  ));
                                                }
                                              };
                                              
                                              const handleMouseUp = () => {
                                                document.removeEventListener('mousemove', handleMouseMove);
                                                document.removeEventListener('mouseup', handleMouseUp);
                                              };
                                              
                                              document.addEventListener('mousemove', handleMouseMove);
                                              document.addEventListener('mouseup', handleMouseUp);
                                            }}
                                          />
                                        )}
                                        
                                        {/* 行高调整手柄 - 只在非最后一行显示 */}
                                        {rowIndex < (component.gridRows || 3) - 1 && colIndex === 0 && (
                                          <div
                                            style={{
                                              position: 'absolute',
                                              bottom: '-2px',
                                              left: 0,
                                              width: '100%',
                                              height: '4px',
                                              cursor: 'row-resize',
                                              backgroundColor: 'transparent',
                                              zIndex: 10
                                            }}
                                            onMouseDown={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              
                                              const startY = e.clientY;
                                              const tableRect = e.currentTarget.closest('table')?.getBoundingClientRect();
                                              if (!tableRect) return;
                                              
                                              const currentHeights = component.gridRowHeights || 
                                                Array(component.gridRows || 3).fill(100 / (component.gridRows || 3));
                                              
                                              const handleMouseMove = (moveEvent: MouseEvent) => {
                                                const deltaY = moveEvent.clientY - startY;
                                                const deltaPercent = (deltaY / tableRect.height) * 100;
                                                
                                                const newHeights = [...currentHeights];
                                                const minHeight = 5; // 最小高度5%
                                                
                                                // 调整当前行和下一行的高度
                                                if (newHeights[rowIndex] + deltaPercent >= minHeight && 
                                                    newHeights[rowIndex + 1] - deltaPercent >= minHeight) {
                                                  newHeights[rowIndex] += deltaPercent;
                                                  newHeights[rowIndex + 1] -= deltaPercent;
                                                  
                                                  setCanvasComponents(prev => prev.map(c => 
                                                    c.id === component.id 
                                                      ? { ...c, gridRowHeights: newHeights }
                                                      : c
                                                  ));
                                                }
                                              };
                                              
                                              const handleMouseUp = () => {
                                                document.removeEventListener('mousemove', handleMouseMove);
                                                document.removeEventListener('mouseup', handleMouseUp);
                                              };
                                              
                                              document.addEventListener('mousemove', handleMouseMove);
                                              document.addEventListener('mouseup', handleMouseUp);
                                            }}
                                          />
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        getComponentDisplayValue(component)
                      )}
                      <div
                        className="resize-handle"
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          right: 0,
                          width: '12px',
                          height: '12px',
                          backgroundColor: '#007bff',
                          cursor: 'se-resize',
                          borderRadius: '0 0 4px 0'
                        }}
                        onMouseDown={(e) => handleResizeMouseDown(e, component.id)}
                      />
                    </div>
                  ))}
                  
                  {/* 渲染对齐辅助线 */}
                  {alignmentGuides.map((guide, index) => (
                    <div
                      key={`guide-${index}`}
                      className="alignment-guide"
                      style={{
                        position: 'absolute',
                        backgroundColor: '#ff4444',
                        zIndex: 999,
                        pointerEvents: 'none',
                        ...(guide.type === 'vertical' ? {
                          left: guide.position,
                          top: guide.start,
                          width: '1px',
                          height: guide.end - guide.start
                        } : {
                          left: guide.start,
                          top: guide.position,
                          width: guide.end - guide.start,
                          height: '1px'
                        })
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
      
      {/* 记录选择弹窗 */}
      {showRecordModal && (
        <div className="modal-overlay" onClick={() => setShowRecordModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>选择记录</h3>
              <button 
                className="modal-close-button"
                onClick={() => setShowRecordModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              {isLoadingRecords ? (
                <div className="loading-message">正在加载数据表记录...</div>
              ) : tableRecords.length > 0 ? (
                <div>
                  <div className="records-table-container">
                    <table className="records-table">
                      <thead>
                         <tr>
                           <th>操作</th>
                           {tableFields.map((field) => (
                             <th key={field.id}>{field.name}</th>
                           ))}
                         </tr>
                       </thead>
                      <tbody>
                        {tableRecords
                          .slice((currentPage - 1) * recordsPerPage, currentPage * recordsPerPage)
                          .map((record) => (
                          <tr key={record.recordId}>
                             <td>
                               <button 
                                 className="select-record-btn"
                                 onClick={() => {
                                   setSelectedRecord(record);
                                   setShowRecordModal(false);
                                 }}
                               >
                                 选择
                               </button>
                             </td>
                             {tableFields.map((field) => (
                               <td key={field.id} title={formatFieldValue(record.fields[field.id], field.type)}>
                                 {formatFieldValue(record.fields[field.id], field.type)}
                               </td>
                             ))}
                           </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* 分页控件 */}
                  <div className="pagination">
                    <div className="pagination-info">
                      共 {tableRecords.length} 条记录，第 {currentPage} 页，共 {Math.ceil(tableRecords.length / recordsPerPage)} 页
                    </div>
                    <div className="pagination-controls">
                      <button 
                        className="pagination-btn"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(currentPage - 1)}
                      >
                        上一页
                      </button>
                      <span className="page-numbers">
                        {Array.from({ length: Math.ceil(tableRecords.length / recordsPerPage) }, (_, i) => i + 1)
                          .filter(page => 
                            page === 1 || 
                            page === Math.ceil(tableRecords.length / recordsPerPage) || 
                            Math.abs(page - currentPage) <= 2
                          )
                          .map((page, index, array) => (
                            <React.Fragment key={page}>
                              {index > 0 && array[index - 1] !== page - 1 && <span className="pagination-ellipsis">...</span>}
                              <button
                                className={`pagination-number ${currentPage === page ? 'active' : ''}`}
                                onClick={() => setCurrentPage(page)}
                              >
                                {page}
                              </button>
                            </React.Fragment>
                          ))
                        }
                      </span>
                      <button 
                        className="pagination-btn"
                        disabled={currentPage === Math.ceil(tableRecords.length / recordsPerPage)}
                        onClick={() => setCurrentPage(currentPage + 1)}
                      >
                        下一页
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="no-records-message">暂无数据记录</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 保存模板弹窗 */}
      {showSaveTemplateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>保存为模板</h3>
              <button 
                className="modal-close"
                onClick={() => {
                  setShowSaveTemplateModal(false);
                  setTemplateName('');
                }}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>模板名称:</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="请输入模板名称"
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
              </div>
              <div className="form-group">
                <p style={{ color: '#666', fontSize: '12px', margin: '8px 0' }}>
                  将保存当前画布中的所有组件配置，包括位置、样式和内容设置。
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn-cancel"
                onClick={() => {
                  setShowSaveTemplateModal(false);
                  setTemplateName('');
                }}
              >
                取消
              </button>
              <button 
                className="btn-primary"
                onClick={saveTemplate}
                disabled={!templateName.trim()}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 选择模板弹窗 */}
      {showTemplateModal && (
        <div className="modal-overlay" onClick={() => setShowTemplateModal(false)}>
          <div className="modal-content" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>选择模板</h3>
              <button 
                className="modal-close-button"
                onClick={() => setShowTemplateModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              {getCurrentTableTemplates().length > 0 ? (
                <div className="template-list">
                  {getCurrentTableTemplates().map((template) => (
                    <div key={template.id} className="template-item">
                      <div className="template-info">
                        <h4>{template.name}</h4>
                        <p style={{ color: '#666', fontSize: '12px', margin: '4px 0' }}>
                          创建时间: {new Date(template.createdAt).toLocaleString('zh-CN')}
                        </p>
                        <p style={{ color: '#666', fontSize: '12px', margin: '4px 0' }}>
                          组件数量: {template.components.length} 个
                        </p>
                      </div>
                      <div className="template-actions">
                        <button 
                          className="btn-primary"
                          onClick={() => loadTemplate(template)}
                          style={{ marginRight: '8px' }}
                        >
                          加载
                        </button>
                        <button 
                          className="btn-danger"
                          onClick={() => deleteTemplate(template.id)}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-templates-message">
                  <p style={{ textAlign: 'center', color: '#666', padding: '40px 20px' }}>
                    当前数据表暂无保存的模板
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;