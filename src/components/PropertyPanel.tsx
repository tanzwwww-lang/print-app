import React from 'react';
import { PropertyPanelProps } from '../types';

const PropertyPanel: React.FC<PropertyPanelProps> = ({
  component,
  onUpdate,
  allTables,
  fetchTableViews,
  fetchViewFields
}) => {
  if (!component) {
    return (
      <div className="property-panel">
        <h3>属性面板</h3>
        <p>请选择一个组件来编辑属性</p>
      </div>
    );
  }

  return (
    <div className="property-panel">
      <h3>属性面板</h3>
      
      <div className="property-section">
        <label>组件类型:</label>
        <span>{component.type}</span>
      </div>
      
      <div className="property-section">
        <label>X坐标:</label>
        <input
          type="number"
          value={component.x}
          onChange={(e) => onUpdate({ x: Number(e.target.value) })}
        />
      </div>
      
      <div className="property-section">
        <label>Y坐标:</label>
        <input
          type="number"
          value={component.y}
          onChange={(e) => onUpdate({ y: Number(e.target.value) })}
        />
      </div>
      
      <div className="property-section">
        <label>宽度:</label>
        <input
          type="number"
          value={component.width}
          onChange={(e) => onUpdate({ width: Number(e.target.value) })}
        />
      </div>
      
      <div className="property-section">
        <label>高度:</label>
        <input
          type="number"
          value={component.height}
          onChange={(e) => onUpdate({ height: Number(e.target.value) })}
        />
      </div>
      
      {component.type === 'text' && (
        <>
          <div className="property-section">
            <label>内容:</label>
            <textarea
              value={component.content || ''}
              onChange={(e) => onUpdate({ content: e.target.value })}
              rows={3}
            />
          </div>
          
          <div className="property-section">
            <label>字体大小:</label>
            <input
              type="number"
              min="8"
              max="72"
              value={component.fontSize || 14}
              onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })}
            />
          </div>
          
          <div className="property-section">
            <label>颜色:</label>
            <input
              type="color"
              value={component.color || '#000000'}
              onChange={(e) => onUpdate({ color: e.target.value })}
            />
          </div>
          
          <div className="property-section">
            <label>字重:</label>
            <select
              value={component.fontWeight || 'normal'}
              onChange={(e) => onUpdate({ fontWeight: e.target.value as 'normal' | 'bold' })}
            >
              <option value="normal">正常</option>
              <option value="bold">粗体</option>
            </select>
          </div>
          
          <div className="property-section">
            <label>对齐:</label>
            <select
              value={component.textAlign || 'left'}
              onChange={(e) => onUpdate({ textAlign: e.target.value as 'left' | 'center' | 'right' })}
            >
              <option value="left">左对齐</option>
              <option value="center">居中</option>
              <option value="right">右对齐</option>
            </select>
          </div>
          
          <div className="property-section">
            <label>行高:</label>
            <input
              type="number"
              min="1"
              max="3"
              step="0.1"
              value={component.lineHeight || 1.5}
              onChange={(e) => onUpdate({ lineHeight: Number(e.target.value) })}
            />
          </div>
        </>
      )}
      
      {component.type === 'table' && (
        <>
          <div className="property-section">
            <label>选择数据表:</label>
            <select
              value={component.selectedTableId || ''}
              onChange={async (e) => {
                const tableId = e.target.value;
                let tableViews: any[] = [];
                
                if (tableId) {
                  tableViews = await fetchTableViews(tableId);
                }
                
                onUpdate({ 
                  selectedTableId: tableId, 
                  tableViews,
                  selectedViewId: '',
                  viewFields: []
                });
              }}
              style={{ width: '100%' }}
            >
              <option value="">请选择数据表</option>
              {allTables.map((table: any) => (
                <option key={table.id} value={table.id}>
                  {table.name}
                </option>
              ))}
            </select>
          </div>
          
          {component.tableViews && component.tableViews.length > 0 && (
            <div className="property-section">
              <label>选择视图:</label>
              <select
                value={component.selectedViewId || ''}
                onChange={async (e) => {
                  const viewId = e.target.value;
                  let viewFields: any[] = [];
                  
                  if (viewId && component.selectedTableId) {
                    viewFields = await fetchViewFields(component.selectedTableId, viewId);
                  }
                  
                  onUpdate({ 
                    selectedViewId: viewId,
                    viewFields
                  });
                }}
                style={{ width: '100%' }}
              >
                <option value="">请选择视图</option>
                {component.tableViews.map((view: any) => (
                  <option key={view.id} value={view.id}>
                    {view.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          <div className="property-section">
            <label>表头背景色:</label>
            <input
              type="color"
              value={component.headerBackgroundColor || '#f5f5f5'}
              onChange={(e) => onUpdate({ headerBackgroundColor: e.target.value })}
            />
          </div>
          
          <div className="property-section">
            <label>表头字重:</label>
            <select
              value={component.headerFontWeight || 'bold'}
              onChange={(e) => onUpdate({ headerFontWeight: e.target.value as 'normal' | 'bold' })}
            >
              <option value="normal">正常</option>
              <option value="bold">粗体</option>
            </select>
          </div>
        </>
      )}
      
      {component.type === 'grid' && (
        <>
          <div className="property-section">
            <label>行数:</label>
            <input
              type="number"
              min="1"
              max="20"
              value={component.gridRows || 3}
              onChange={(e) => {
                const newRows = Number(e.target.value) || 1;
                const currentRows = component.gridRows || 3;
                let newRowHeights = component.gridRowHeights || Array(currentRows).fill(100 / currentRows);
                
                if (newRows > currentRows) {
                  const averageHeight = 100 / newRows;
                  newRowHeights = Array(newRows).fill(averageHeight);
                } else if (newRows < currentRows) {
                  newRowHeights = newRowHeights.slice(0, newRows);
                  const totalHeight = newRowHeights.reduce((sum, h) => sum + h, 0);
                  if (totalHeight !== 100) {
                    const factor = 100 / totalHeight;
                    newRowHeights = newRowHeights.map(h => h * factor);
                  }
                }
                
                onUpdate({ gridRows: newRows, gridRowHeights: newRowHeights });
              }}
            />
          </div>
          
          <div className="property-section">
            <label>列数:</label>
            <input
              type="number"
              min="1"
              max="20"
              value={component.gridColumns || 3}
              onChange={(e) => {
                const newColumns = Number(e.target.value) || 1;
                const currentColumns = component.gridColumns || 3;
                let newColumnWidths = component.gridColumnWidths || Array(currentColumns).fill(100 / currentColumns);
                
                if (newColumns > currentColumns) {
                  const averageWidth = 100 / newColumns;
                  newColumnWidths = Array(newColumns).fill(averageWidth);
                } else if (newColumns < currentColumns) {
                  newColumnWidths = newColumnWidths.slice(0, newColumns);
                  const totalWidth = newColumnWidths.reduce((sum, w) => sum + w, 0);
                  if (totalWidth !== 100) {
                    const factor = 100 / totalWidth;
                    newColumnWidths = newColumnWidths.map(w => w * factor);
                  }
                }
                
                onUpdate({ gridColumns: newColumns, gridColumnWidths: newColumnWidths });
              }}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default PropertyPanel;