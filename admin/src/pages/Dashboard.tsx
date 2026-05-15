import { useState } from 'react';
import { Card, Statistic, Row, Col, Table, Tag } from 'antd';
import {
  FileTextOutlined,
  PictureOutlined,
  VideoCameraOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { entryApi, userApi } from '../services/api';

export default function Dashboard() {
  const [_timeRange, _setTimeRange] = useState('7d');

  const { data: entriesData } = useQuery({
    queryKey: ['entries', 'dashboard'],
    queryFn: () => entryApi.getEntries({ limit: 5 }),
  });

  const { data: usersData } = useQuery({
    queryKey: ['users', 'dashboard'],
    queryFn: () => userApi.getUsers(),
  });

  const recentEntries = entriesData?.data?.items || [];
  const users = usersData?.data || [];

  const stats = [
    {
      title: '总记录数',
      value: entriesData?.data?.total || 0,
      icon: <FileTextOutlined style={{ color: '#ff8c69' }} />,
    },
    {
      title: '照片数',
      value: 0,
      icon: <PictureOutlined style={{ color: '#52c41a' }} />,
    },
    {
      title: '视频数',
      value: 0,
      icon: <VideoCameraOutlined style={{ color: '#1890ff' }} />,
    },
    {
      title: '用户数',
      value: users.length,
      icon: <UserOutlined style={{ color: '#722ed1' }} />,
    },
  ];

  const columns = [
    {
      title: '内容',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      render: (text: string) => text.slice(0, 50) + (text.length > 50 ? '...' : ''),
    },
    {
      title: '作者',
      dataIndex: ['creator', 'nickname'],
      key: 'creator',
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '标签',
      dataIndex: 'milestones',
      key: 'milestones',
      render: (milestones: any[]) =>
        milestones?.map((m) => (
          <Tag key={m.id} color={m.color || '#ff8c69'}>
            {m.icon} {m.name}
          </Tag>
        )) || null,
    },
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {stats.map((stat, index) => (
          <Col span={6} key={index}>
            <Card>
              <Statistic
                title={stat.title}
                value={stat.value}
                prefix={stat.icon}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card title="最近记录" extra={<a href="/entries">查看全部</a>}>
        <Table
          dataSource={recentEntries}
          columns={columns}
          rowKey="id"
          pagination={false}
        />
      </Card>
    </div>
  );
}
