import React, { forwardRef } from 'react';
import { CanvasProps, ComponentType } from '../types';

const Canvas = forwardRef<HTMLDivElement, CanvasProps>((
  {
    components,
    selectedComponent,
    onComponentSelect,
    onComponentUpdate,
    onComponentDelete,
    onDragOver,
    onDrop,
    onClick,
    size,
    zoom,
    showGrid,
    gridSize,
    snapToGrid,
    isDragging,
    setIsDragging,
    dragOffset,
    setDragOffset,
    isResizing,
    setIsResizing,
    resizeHandle,
    setResizeHandle
  },
  ref
) => {
  const handleComponentMouseDown = (e: React.MouseEvent, component: ComponentType) => {
    e.stopPropagation();
    onComponentSelect(component.id);
    
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    
    setDragOffset({ x: offsetX, y: offsetY });
    setIsDragging(true);
  };

  const handleComponentDoubleClick = (component: ComponentType) => {
    if (component.type === 'text') {
      const newContent = prompt('编辑文本内容:', component.content || '');
      if (newContent !== null) {
        onComponentUpdate(component.id, { content: newContent });
      }
    }
  };

  const renderComponent = (component: ComponentType) => {
    const isSelected = selectedComponent === component.id;
    
    let content = component.content || '';
    
    // 根据组件类型渲染不同内容
    switch (component.type) {
      case 'text':
        content = content || '文本内容';
        break;
      case 'image':
        content = '图片占位符';
        break;
      case 'table':
        if (component.viewFields && component.viewFields.length > 0) {
          // 渲染多维表格
          content = `
            <table style="width: 100%; height: 100%; border-collapse: collapse;">
              <thead>
                <tr>
                  ${component.viewFields.map((field: any) => 
                    `<th style="border: 1px solid #ccc; padding: 4px; background-color: ${component.headerBackgroundColor || '#f5f5f5'}; font-weight: ${component.headerFontWeight || 'bold'};">${field.name}</th>`
                  ).join('')}
                </tr>
              </thead>
              <tbody>
                <tr>
                  ${component.viewFields.map(() => 
                    `<td style="border: 1px solid #ccc; padding: 4px;">数据</td>`
                  ).join('')}
                </tr>
              </tbody>
            </table>
          `;
        } else {
          content = '请选择数据表和视图';
        }
        break;
      case 'grid':
        // 渲染表格网格
        const rows = component.gridRows || 3;
        const cols = component.gridColumns || 3;
        const rowHeights = component.gridRowHeights || Array(rows).fill(100 / rows);
        const colWidths = component.gridColumnWidths || Array(cols).fill(100 / cols);
        
        let gridHtml = '<table style="width: 100%; height: 100%; border-collapse: collapse;">';
        for (let i = 0; i < rows; i++) {
          gridHtml += '<tr>';
          for (let j = 0; j < cols; j++) {
            gridHtml += `<td style="border: 1px solid #ccc; width: ${colWidths[j]}%; height: ${rowHeights[i]}%; padding: 2px;">单元格</td>`;
          }
          gridHtml += '</tr>';
        }
        gridHtml += '</table>';
        content = gridHtml;
        break;
      default:
        content = '未知组件';
    }

    return (
      <div
        key={component.id}
        className={`canvas-component ${isSelected ? 'selected' : ''}`}
        style={{
          position: 'absolute',
          left: component.x,
          top: component.y,
          width: component.width,
          height: component.height,
          fontSize: component.fontSize || 14,
          color: component.color || '#000',
          fontWeight: component.fontWeight || 'normal',
          textAlign: component.textAlign || 'left',
          lineHeight: component.lineHeight || 1.5,
          border: isSelected ? '2px solid #007bff' : '1px solid #ddd',
          cursor: 'move',
          backgroundColor: 'white',
          overflow: 'hidden',
          userSelect: 'none'
        }}
        onMouseDown={(e) => handleComponentMouseDown(e, component)}
        onDoubleClick={() => handleComponentDoubleClick(component)}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  };

  return (
    <div className="canvas-container">
      <div
        ref={ref}
        className="canvas"
        style={{
          width: `${size.width * zoom}px`,
          height: `${size.height * zoom}px`,
          transform: `scale(${zoom})`,
          transformOrigin: 'top left',
          position: 'relative',
          backgroundColor: 'white',
          border: '1px solid #ccc',
          backgroundImage: showGrid ? 
            `linear-gradient(to right, #f0f0f0 1px, transparent 1px),
             linear-gradient(to bottom, #f0f0f0 1px, transparent 1px)` : 'none',
          backgroundSize: showGrid ? `${gridSize}px ${gridSize}px` : 'auto'
        }}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onClick={onClick}
      >
        {components.map(renderComponent)}
      </div>
    </div>
  );
});

Canvas.displayName = 'Canvas';

export default Canvas;