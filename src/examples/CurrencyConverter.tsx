import React, { useState, useEffect } from 'react';
import { bitable, FieldType, ICurrencyField, ICurrencyFieldMeta, CurrencyCode } from '@lark-base-open/js-sdk';
import { Button, Select, Alert, Card, Space, Typography, Spin } from 'antd';
import axios from 'axios';

const { Title, Text } = Typography;
const { Option } = Select;

// 支持的货币类型
const CURRENCY_OPTIONS = [
  { label: 'CNY (人民币)', value: CurrencyCode.CNY },
  { label: 'USD (美元)', value: CurrencyCode.USD },
  { label: 'EUR (欧元)', value: CurrencyCode.EUR },
  { label: 'JPY (日元)', value: CurrencyCode.JPY },
  { label: 'GBP (英镑)', value: CurrencyCode.GBP },
  { label: 'HKD (港币)', value: CurrencyCode.HKD },
];

// 汇率API接口
interface ExchangeRatesResponse {
  rates: {
    [key: string]: number;
  };
  base: string;
  date: string;
}

// 获取汇率
async function getExchangeRate(base: string, target: string): Promise<number | undefined> {
  try {
    const response = await axios.get<ExchangeRatesResponse>(
      `https://api.exchangerate-api.com/v4/latest/${base}`
    );
    const rate = response.data.rates[target];
    
    if (!rate) {
      throw new Error(`Exchange rate not found for target currency: ${target}`);
    }
    
    return rate;
  } catch (error) {
    console.error(`Error fetching exchange rate: ${(error as any).message}`);
    return undefined;
  }
}

const CurrencyConverter: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [currencyFields, setCurrencyFields] = useState<ICurrencyFieldMeta[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string>();
  const [targetCurrency, setTargetCurrency] = useState<CurrencyCode>();
  const [message, setMessage] = useState<string>('');
  const [messageType, setMessageType] = useState<'success' | 'info' | 'warning' | 'error'>('info');

  useEffect(() => {
    loadCurrencyFields();
  }, []);

  const loadCurrencyFields = async () => {
    try {
      const table = await bitable.base.getActiveTable();
      const fieldMetaList = await table.getFieldMetaListByType<ICurrencyFieldMeta>(FieldType.Currency);
      setCurrencyFields(fieldMetaList);
      
      if (fieldMetaList.length === 0) {
        setMessage('当前表格中没有货币字段，请先添加货币字段');
        setMessageType('warning');
      } else {
        setMessage(`找到 ${fieldMetaList.length} 个货币字段`);
        setMessageType('info');
      }
    } catch (error) {
      console.error('加载货币字段失败:', error);
      setMessage('加载货币字段失败');
      setMessageType('error');
    }
  };

  const convertCurrency = async () => {
    if (!selectedFieldId || !targetCurrency) {
      setMessage('请选择要转换的字段和目标货币');
      setMessageType('warning');
      return;
    }

    setLoading(true);
    try {
      const table = await bitable.base.getActiveTable();
      const currencyField = await table.getField<ICurrencyField>(selectedFieldId);
      
      // 获取当前货币类型
      const currentCurrency = await currencyField.getCurrencyCode();
      
      if (currentCurrency === targetCurrency) {
        setMessage('当前货币类型与目标货币类型相同，无需转换');
        setMessageType('info');
        setLoading(false);
        return;
      }
      
      // 获取汇率
      const exchangeRate = await getExchangeRate(currentCurrency, targetCurrency);
      if (!exchangeRate) {
        setMessage('获取汇率失败，请稍后重试');
        setMessageType('error');
        setLoading(false);
        return;
      }
      
      // 获取所有记录
      const recordIdList = await table.getRecordIdList();
      let convertedCount = 0;
      
      // 转换每条记录的货币值
      for (const recordId of recordIdList) {
        try {
          const currentValue = await currencyField.getValue(recordId);
          if (currentValue && typeof currentValue === 'number') {
            const newValue = Math.round(currentValue * exchangeRate * 100) / 100; // 保留两位小数
            await currencyField.setValue(recordId, newValue);
            convertedCount++;
          }
        } catch (error) {
          console.warn(`转换记录 ${recordId} 失败:`, error);
        }
      }
      
      // 更新字段的货币类型
      await currencyField.setCurrencyCode(targetCurrency);
      
      setMessage(`货币转换完成！共转换了 ${convertedCount} 条记录，汇率: 1 ${currentCurrency} = ${exchangeRate} ${targetCurrency}`);
      setMessageType('success');
      
    } catch (error) {
      console.error('货币转换失败:', error);
      setMessage('货币转换失败，请检查数据和网络连接');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="💱 货币转换器" style={{ margin: '20px 0' }}>
      <Space direction="vertical" style={{ width: '100%' }}>
        {message && (
          <Alert
            message={message}
            type={messageType}
            showIcon
            closable
            onClose={() => setMessage('')}
          />
        )}
        
        <div>
          <Text strong>选择货币字段：</Text>
          <Select
            style={{ width: '100%', marginTop: 8 }}
            placeholder="请选择要转换的货币字段"
            value={selectedFieldId}
            onChange={setSelectedFieldId}
            disabled={currencyFields.length === 0}
          >
            {currencyFields.map(field => (
              <Option key={field.id} value={field.id}>
                {field.name}
              </Option>
            ))}
          </Select>
        </div>
        
        <div>
          <Text strong>选择目标货币：</Text>
          <Select
            style={{ width: '100%', marginTop: 8 }}
            placeholder="请选择目标货币类型"
            value={targetCurrency}
            onChange={setTargetCurrency}
          >
            {CURRENCY_OPTIONS.map(currency => (
              <Option key={currency.value} value={currency.value}>
                {currency.label}
              </Option>
            ))}
          </Select>
        </div>
        
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Button
            type="primary"
            size="large"
            onClick={convertCurrency}
            disabled={!selectedFieldId || !targetCurrency || currencyFields.length === 0}
            loading={loading}
          >
            {loading ? '转换中...' : '开始转换'}
          </Button>
        </div>
        
        <div style={{ marginTop: 20, padding: 16, background: '#f6f8fa', borderRadius: 6 }}>
          <Title level={5}>使用说明：</Title>
          <Space direction="vertical">
            <Text>• 选择要转换的货币字段和目标货币类型</Text>
            <Text>• 系统会自动获取实时汇率进行转换</Text>
            <Text>• 转换会应用到该字段的所有记录</Text>
            <Text>• 转换后字段的货币类型也会更新</Text>
          </Space>
        </div>
      </Space>
    </Card>
  );
};

export default CurrencyConverter;