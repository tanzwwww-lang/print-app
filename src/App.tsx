import React, { useState, useRef, useEffect, useCallback } from 'react';
import './App.css';
import FieldList from './components/FieldList';
import Canvas from './components/Canvas';
import PropertyPanel from './components/PropertyPanel';
import { ComponentType } from './types';

const App: React.FC = () => {
  const [canvasComponents, setCanvasComponents] = useState<ComponentType[]>([]);
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);
  const [draggedComponent, setDraggedComponent] = useState<ComponentType | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string>('');
  const [canvasSize, setCanvasSize] = useState({ width: 210, height: 297 }); // A4 size in mm
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [gridSize, setGridSize] = useState(10);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [allTables, setAllTables] = useState<any[]>([]);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savedTemplates, setSavedTemplates] = useState<any[]>([]);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [showRecordSelector, setShowRecordSelector] = useState(false);
  const [selectedRecords, setSelectedRecords] = useState<any[]>([]);
  const [allRecords, setAllRecords] = useState<any[]>([]);
  const [currentTableId, setCurrentTableId] = useState<string>('');
  const [currentViewId, setCurrentViewId] = useState<string>('');

  // 获取所有数据表
  const fetchAllTables = async () => {
    try {
      // 这里应该调用实际的API
      console.log('获取所有数据表');
      // 模拟数据
      const mockTables = [
        { id: 'table1', name: '用户表' },
        { id: 'table2', name: '订单表' },
        { id: 'table3', name: '产品表' }
      ];
      setAllTables(mockTables);
    } catch (error) {
      console.error('获取数据表失败:', error);
    }
  };

  // 获取表格视图
  const fetchTableViews = async (tableId: string) => {
    try {
      // 这里应该调用实际的API
      console.log('获取表格视图', tableId);
      // 模拟数据
      return [
        { id: 'view1', name: '默认视图' },
        { id: 'view2', name: '详细视图' }
      ];
    } catch (error) {
      console.error('获取表格视图失败:', error);
      return [];
    }
  };

  // 获取视图字段
  const fetchViewFields = async (tableId: string, viewId: string) => {
    try {
      // 这里应该调用实际的API
      console.log('获取视图字段', { tableId, viewId });
      // 模拟数据
      return [
        { id: 'field1', name: '姓名', type: 'text' },
        { id: 'field2', name: '年龄', type: 'number' },
        { id: 'field3', name: '邮箱', type: 'email' }
      ];
    } catch (error) {
      console.error('获取视图字段失败:', error);
      return [];
    }
  };

  // 获取记录数据
  const fetchRecords = async (tableId: string, viewId: string) => {
    try {
      console.log('获取记录数据', { tableId, viewId });
      // 模拟数据
      const mockRecords = [
        { id: 'record1', fields: { '姓名': '张三', '年龄': 25, '邮箱': 'zhangsan@example.com' } },
        { id: 'record2', fields: { '姓名': '李四', '年龄': 30, '邮箱': 'lisi@example.com' } },
        { id: 'record3', fields: { '姓名': '王五', '年龄': 28, '邮箱': 'wangwu@example.com' } }
      ];
      return mockRecords;
    } catch (error) {
      console.error('获取记录数据失败:', error);
      return [];
    }
  };

  // 保存模板
  const saveTemplate = () => {
    if (!templateName.trim()) {
      alert('请输入模板名称');
      return;
    }

    const template = {
      id: Date.now().toString(),
      name: templateName,
      components: canvasComponents,
      canvasSize,
      createdAt: new Date().toISOString()
    };

    const existingTemplates = JSON.parse(localStorage.getItem('printTemplates') || '[]');
    existingTemplates.push(template);
    localStorage.setItem('printTemplates', JSON.stringify(existingTemplates));
    
    setSavedTemplates(existingTemplates);
    setShowSaveTemplateModal(false);
    setTemplateName('');
    alert('模板保存成功！');
  };

  // 加载保存的模板
  const loadSavedTemplates = () => {
    const templates = JSON.parse(localStorage.getItem('printTemplates') || '[]');
    setSavedTemplates(templates);
  };

  useEffect(() => {
    fetchAllTables();
    loadSavedTemplates();
  }, []);

  const handleDragStart = (component: ComponentType, e: React.DragEvent) => {
    setDraggedComponent(component);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedComponent || !canvasRef.current) return;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - canvasRect.left) / zoom;
    const y = (e.clientY - canvasRect.top) / zoom;

    const newComponent: ComponentType = {
      ...draggedComponent,
      id: `${draggedComponent.type}_${Date.now()}`,
      x: snapToGrid ? Math.round(x / gridSize) * gridSize : x,
      y: snapToGrid ? Math.round(y / gridSize) * gridSize : y,
    };

    setCanvasComponents(prev => [...prev, newComponent]);
    setDraggedComponent(null);
  };

  const handleComponentSelect = (id: string) => {
    setSelectedComponent(id);
  };

  const handleComponentUpdate = (id: string, updates: Partial<ComponentType>) => {
    setCanvasComponents(prev => 
      prev.map(comp => comp.id === id ? { ...comp, ...updates } : comp)
    );
  };

  const handleComponentDelete = (id: string) => {
    setCanvasComponents(prev => prev.filter(comp => comp.id !== id));
    if (selectedComponent === id) {
      setSelectedComponent(null);
    }
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setSelectedComponent(null);
    }
  };

  const selectedComponentData = canvasComponents.find(comp => comp.id === selectedComponent) || null;

  // 打印功能
  const handlePrint = () => {
    if (selectedRecords.length === 0) {
      alert('请先选择要打印的记录');
      return;
    }

    // 创建打印窗口
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // 生成打印内容
    let printContent = `
      <html>
        <head>
          <title>打印</title>
          <style>
            body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
            .print-page { 
              width: ${canvasSize.width}mm; 
              height: ${canvasSize.height}mm; 
              margin-bottom: 20px;
              page-break-after: always;
              position: relative;
              border: 1px solid #ccc;
            }
            .component {
              position: absolute;
              box-sizing: border-box;
            }
            @media print {
              body { margin: 0; padding: 0; }
              .print-page { border: none; margin: 0; }
            }
          </style>
        </head>
        <body>
    `;

    // 为每个选中的记录生成一页
    selectedRecords.forEach((record, index) => {
      printContent += `<div class="print-page">`;
      
      canvasComponents.forEach(component => {
        let content = component.content || '';
        
        // 如果是多维表格组件，替换为实际数据
        if (component.type === 'table' && component.viewFields) {
          // 生成表格HTML
          content = `
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr>
                  ${component.viewFields.map((field: any) => 
                    `<th style="border: 1px solid #ccc; padding: 4px; background-color: ${component.headerBackgroundColor || '#f5f5f5'}; font-weight: ${component.headerFontWeight || 'bold'};">${field.name}</th>`
                  ).join('')}
                </tr>
              </thead>
              <tbody>
                <tr>
                  ${component.viewFields.map((field: any) => 
                    `<td style="border: 1px solid #ccc; padding: 4px;">${record.fields[field.name] || ''}</td>`
                  ).join('')}
                </tr>
              </tbody>
            </table>
          `;
        } else {
          // 替换文本中的字段占位符
          Object.keys(record.fields).forEach(fieldName => {
            const placeholder = `{{${fieldName}}}`;
            content = content.replace(new RegExp(placeholder, 'g'), record.fields[fieldName] || '');
          });
        }
        
        printContent += `
          <div class="component" style="
            left: ${component.x}px;
            top: ${component.y}px;
            width: ${component.width}px;
            height: ${component.height}px;
            font-size: ${component.fontSize || 14}px;
            color: ${component.color || '#000'};
            font-weight: ${component.fontWeight || 'normal'};
            text-align: ${component.textAlign || 'left'};
            line-height: ${component.lineHeight || 1.5};
            ${component.type === 'table' ? '' : 'border: 1px solid #ddd; padding: 4px;'}
          ">
            ${content}
          </div>
        `;
      });
      
      printContent += `</div>`;
    });

    printContent += `
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="app">
      <div className="toolbar">
        <div className="toolbar-section">
          <label>画布尺寸:</label>
          <select 
            value={`${canvasSize.width}x${canvasSize.height}`}
            onChange={(e) => {
              const [width, height] = e.target.value.split('x').map(Number);
              setCanvasSize({ width, height });
            }}
          >
            <option value="210x297">A4 (210×297mm)</option>
            <option value="148x210">A5 (148×210mm)</option>
            <option value="105x148">A6 (105×148mm)</option>
          </select>
        </div>
        
        <div className="toolbar-section">
          <label>缩放:</label>
          <select value={zoom} onChange={(e) => setZoom(Number(e.target.value))}>
            <option value={0.5}>50%</option>
            <option value={0.75}>75%</option>
            <option value={1}>100%</option>
            <option value={1.25}>125%</option>
            <option value={1.5}>150%</option>
          </select>
        </div>
        
        <div className="toolbar-section">
          <label>
            <input 
              type="checkbox" 
              checked={showGrid} 
              onChange={(e) => setShowGrid(e.target.checked)}
            />
            显示网格
          </label>
        </div>
        
        <div className="toolbar-section">
          <label>
            <input 
              type="checkbox" 
              checked={snapToGrid} 
              onChange={(e) => setSnapToGrid(e.target.checked)}
            />
            吸附网格
          </label>
        </div>
        
        <div className="toolbar-section">
          <button 
            onClick={() => setShowSaveTemplateModal(true)}
            className="save-template-btn"
          >
            保存模板
          </button>
        </div>
        
        <div className="toolbar-section">
          <button 
            onClick={() => setShowRecordSelector(true)}
            className="select-records-btn"
          >
            选择记录 ({selectedRecords.length})
          </button>
        </div>
        
        <div className="toolbar-section">
          <button 
            onClick={handlePrint}
            className="print-btn"
            disabled={selectedRecords.length === 0}
          >
            打印
          </button>
        </div>
      </div>

      <div className="main-content">
        <FieldList />
        
        <Canvas
          ref={canvasRef}
          components={canvasComponents}
          selectedComponent={selectedComponent}
          onComponentSelect={handleComponentSelect}
          onComponentUpdate={handleComponentUpdate}
          onComponentDelete={handleComponentDelete}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={handleCanvasClick}
          size={canvasSize}
          zoom={zoom}
          showGrid={showGrid}
          gridSize={gridSize}
          snapToGrid={snapToGrid}
          isDragging={isDragging}
          setIsDragging={setIsDragging}
          dragOffset={dragOffset}
          setDragOffset={setDragOffset}
          isResizing={isResizing}
          setIsResizing={setIsResizing}
          resizeHandle={resizeHandle}
          setResizeHandle={setResizeHandle}
        />
        
        <PropertyPanel
          component={selectedComponentData}
          onUpdate={(updates) => {
            if (selectedComponent) {
              handleComponentUpdate(selectedComponent, updates);
            }
          }}
          allTables={allTables}
          fetchTableViews={(tableId: string) => fetchTableViews(tableId)}
          fetchViewFields={(tableId: string, viewId: string) => fetchViewFields(tableId, viewId)}
        />
      </div>

      {/* 保存模板弹窗 */}
      {showSaveTemplateModal && (
        <div className="modal-overlay" onClick={() => setShowSaveTemplateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>保存模板</h3>
            <input
              type="text"
              placeholder="请输入模板名称"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              style={{ width: '100%', padding: '8px', marginBottom: '16px' }}
            />
            <div className="modal-buttons">
              <button onClick={() => setShowSaveTemplateModal(false)}>取消</button>
              <button 
                onClick={saveTemplate}
                disabled={!templateName.trim()}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 记录选择弹窗 */}
      {showRecordSelector && (
        <div className="modal-overlay" onClick={() => setShowRecordSelector(false)}>
          <div className="modal-content record-selector" onClick={(e) => e.stopPropagation()}>
            <h3>选择要打印的记录</h3>
            
            <div className="table-view-selector">
              <div className="selector-row">
                <label>数据表:</label>
                <select
                  value={currentTableId}
                  onChange={async (e) => {
                    const tableId = e.target.value;
                    setCurrentTableId(tableId);
                    setCurrentViewId('');
                    setAllRecords([]);
                    setSelectedRecords([]);
                  }}
                >
                  <option value="">请选择数据表</option>
                  {allTables.map(table => (
                    <option key={table.id} value={table.id}>{table.name}</option>
                  ))}
                </select>
              </div>
              
              {currentTableId && (
                <div className="selector-row">
                  <label>视图:</label>
                  <select
                    value={currentViewId}
                    onChange={async (e) => {
                      const viewId = e.target.value;
                      setCurrentViewId(viewId);
                      if (viewId && currentTableId) {
                        const records = await fetchRecords(currentTableId, viewId);
                        setAllRecords(records);
                        setSelectedRecords([]);
                      }
                    }}
                  >
                    <option value="">请选择视图</option>
                    <option value="view1">默认视图</option>
                    <option value="view2">详细视图</option>
                  </select>
                </div>
              )}
            </div>
            
            {allRecords.length > 0 && (
              <div className="records-list">
                <div className="records-header">
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedRecords.length === allRecords.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRecords([...allRecords]);
                        } else {
                          setSelectedRecords([]);
                        }
                      }}
                    />
                    全选 ({allRecords.length} 条记录)
                  </label>
                </div>
                
                <div className="records-content">
                  {allRecords.map(record => (
                    <div key={record.id} className="record-item">
                      <label>
                        <input
                          type="checkbox"
                          checked={selectedRecords.some(r => r.id === record.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRecords(prev => [...prev, record]);
                            } else {
                              setSelectedRecords(prev => prev.filter(r => r.id !== record.id));
                            }
                          }}
                        />
                        <span className="record-info">
                          {Object.entries(record.fields).slice(0, 3).map(([key, value]) => (
                            <span key={key} className="field-value">{key}: {String(value)}</span>
                          ))}
                        </span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="modal-buttons">
              <button onClick={() => setShowRecordSelector(false)}>取消</button>
              <button 
                onClick={() => setShowRecordSelector(false)}
                disabled={selectedRecords.length === 0}
              >
                确定 ({selectedRecords.length} 条)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;