import { Card, Descriptions, Tag } from 'antd';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

export default function Settings() {
  const { data: configData } = useQuery({
    queryKey: ['config'],
    queryFn: async () => {
      const response = await axios.get('/api/config');
      return response.data;
    },
  });

  const config = configData || {};

  return (
    <div>
      <Card title="系统信息" style={{ marginBottom: 24 }}>
        <Descriptions bordered column={2}>
          <Descriptions.Item label="应用名称">
            {config.app?.name || '小日子'}
          </Descriptions.Item>
          <Descriptions.Item label="版本">1.0.0</Descriptions.Item>
          <Descriptions.Item label="描述">
            {config.app?.description || '宝宝成长记录应用'}
          </Descriptions.Item>
          <Descriptions.Item label="默认语言">
            {config.app?.defaultLanguage || 'zh-CN'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="存储设置" style={{ marginBottom: 24 }}>
        <Descriptions bordered column={2}>
          <Descriptions.Item label="上传路径">
            {config.storage?.uploadPath || './uploads'}
          </Descriptions.Item>
          <Descriptions.Item label="备份启用">
            <Tag color={config.storage?.backupEnabled ? 'green' : 'red'}>
              {config.storage?.backupEnabled ? '是' : '否'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="备份间隔">
            {config.storage?.backupInterval || '未设置'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="功能开关">
        <Descriptions bordered column={2}>
          <Descriptions.Item label="垃圾桶">
            <Tag color={config.features?.enableTrash ? 'green' : 'red'}>
              {config.features?.enableTrash ? '启用' : '禁用'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="保留天数">
            {config.features?.trashRetentionDays || 30} 天
          </Descriptions.Item>
          <Descriptions.Item label="通知">
            <Tag color={config.features?.enableNotifications ? 'green' : 'red'}>
              {config.features?.enableNotifications ? '启用' : '禁用'}
            </Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
}
