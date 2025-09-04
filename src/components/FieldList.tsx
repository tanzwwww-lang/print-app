import React, { useState, useEffect } from 'react';
import { bitable, IFieldMeta } from '@lark-base-open/js-sdk';
import { Card, Typography, Space } from 'antd';

const { Text } = Typography;

interface FieldListProps {
  className?: string;
  onDragStart?: (data: any) => void;
}

const FieldList: React.FC<FieldListProps> = ({ className }) => {
  const [fields, setFields] = useState<IFieldMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableName, setTableName] = useState<string>('');

  useEffect(() => {
    const fetchFields = async () => {
      try {
        setLoading(true);
        const table = await bitable.base.getActiveTable();
        const name = await table.getName();
        const fieldMetaList = await table.getFieldMetaList();
        
        setTableName(name);
        setFields(fieldMetaList);
      } catch (error) {
        console.error('获取字段信息失败:', error);
      } finally {
        setLoading(false);
      }
    };

    // 初始加载
    fetchFields();

    // 监听表格切换事件
    const unsubscribe = bitable.base.onSelectionChange(() => {
      fetchFields();
    });

    // 清理监听器
    return () => {
      unsubscribe();
    };
  }, []);



  return (
    <div className={className} style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '8px', overflow: 'auto' }}>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100px' }}>
          <Text>加载中...</Text>
        </div>
      ) : (
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          {/* 文本组件 */}
          <Card
            key="text-component"
            size="small"
            hoverable
            draggable
            style={{
              cursor: 'grab',
              borderRadius: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              backgroundColor: '#f0f8ff'
            }}
            styles={{
              body: { padding: '12px 16px' }
            }}
            onDragStart={(e: React.DragEvent<HTMLDivElement>) => {
              e.dataTransfer.setData('application/json', JSON.stringify({
                id: 'text-component',
                name: '文本组件',
                type: 'text'
              }));
              e.dataTransfer.effectAllowed = 'copy';
            }}
            onDragEnd={(e: React.DragEvent<HTMLDivElement>) => {
              e.currentTarget.style.cursor = 'grab';
            }}
          >
            <Text style={{ fontSize: '14px', fontWeight: '500', color: '#1890ff' }}>
              📝 文本组件
            </Text>
          </Card>
          
          {/* 多维表格组件 */}
          <Card
            key="table-component"
            size="small"
            hoverable
            draggable
            style={{
              cursor: 'grab',
              borderRadius: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              backgroundColor: '#f0fff0'
            }}
            styles={{
              body: { padding: '12px 16px' }
            }}
            onDragStart={(e: React.DragEvent<HTMLDivElement>) => {
              e.dataTransfer.setData('application/json', JSON.stringify({
                id: 'table-component',
                name: '多维表格',
                type: 'table'
              }));
              e.dataTransfer.effectAllowed = 'copy';
            }}
            onDragEnd={(e: React.DragEvent<HTMLDivElement>) => {
              e.currentTarget.style.cursor = 'grab';
            }}
          >
            <Text style={{ fontSize: '14px', fontWeight: '500', color: '#52c41a' }}>
              📊 多维表格
            </Text>
          </Card>
          
          {/* 表格组件 */}
          <Card
            key="grid-component"
            size="small"
            hoverable
            draggable
            style={{
              cursor: 'grab',
              borderRadius: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              backgroundColor: '#fff0f5'
            }}
            styles={{
              body: { padding: '12px 16px' }
            }}
            onDragStart={(e: React.DragEvent<HTMLDivElement>) => {
              e.dataTransfer.setData('application/json', JSON.stringify({
                id: 'grid-component',
                name: '表格',
                type: 'grid'
              }));
              e.dataTransfer.effectAllowed = 'copy';
            }}
            onDragEnd={(e: React.DragEvent<HTMLDivElement>) => {
              e.currentTarget.style.cursor = 'grab';
            }}
          >
            <Text style={{ fontSize: '14px', fontWeight: '500', color: '#eb2f96' }}>
              🔲 表格
            </Text>
          </Card>
          
          {/* 数据字段 */}
          {fields.map((field) => (
            <Card
              key={field.id}
              size="small"
              hoverable
              draggable
              style={{
                cursor: 'grab',
                borderRadius: '6px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
              }}
              styles={{
                body: { padding: '12px 16px' }
              }}
              onDragStart={(e: React.DragEvent<HTMLDivElement>) => {
                e.dataTransfer.setData('application/json', JSON.stringify({
                  id: field.id,
                  name: field.name,
                  type: field.type
                }));
                e.dataTransfer.effectAllowed = 'copy';
              }}
              onDragEnd={(e: React.DragEvent<HTMLDivElement>) => {
                e.currentTarget.style.cursor = 'grab';
              }}
            >
              <Text style={{ fontSize: '14px', fontWeight: '500' }}>
                {field.name}
              </Text>
            </Card>
          ))}
        </Space>
      )}
    </div>
  );
};

export default FieldList;