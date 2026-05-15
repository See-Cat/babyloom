import { useState } from 'react';
import { Table, Button, Input, Image, Modal, message, Tag } from 'antd';
import { SearchOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mediaApi } from '../services/api';

export default function Media() {
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['media', page, pageSize],
    queryFn: () =>
      mediaApi.getMedia({
        page,
        limit: pageSize,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: mediaApi.deleteMedia,
    onSuccess: () => {
      message.success('删除成功');
      queryClient.invalidateQueries({ queryKey: ['media'] });
    },
  });

  const media = data?.data || [];

  const columns = [
    {
      title: '预览',
      dataIndex: 'url',
      key: 'url',
      width: 120,
      render: (url: string, record: any) => (
        <Image
          src={record.thumbnail || url}
          alt=""
          style={{ width: 80, height: 80, objectFit: 'cover' }}
          preview={{ src: url }}
        />
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: string) => (
        <Tag color={type === 'video' ? 'blue' : 'green'}>
          {type === 'video' ? '视频' : '照片'}
        </Tag>
      ),
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 120,
      render: (size: number) =>
        size ? `${(size / 1024 / 1024).toFixed(2)} MB` : '-',
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: any) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => {
            Modal.confirm({
              title: '确认删除',
              content: '确定要删除这个媒体文件吗？',
              onOk: () => deleteMutation.mutate(record.id),
            });
          }}
        />
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <Input.Search
          placeholder="搜索媒体"
          value={searchText}
          onChange={(e: any) => setSearchText(e.target.value)}
          style={{ width: 300 }}
          prefix={<SearchOutlined />}
        />
      </div>

      <Table
        dataSource={media}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        pagination={{
          current: page,
          pageSize,
          onChange: (p: any, ps: any) => {
            setPage(p);
            setPageSize(ps || 10);
          },
        }}
      />
    </div>
  );
}
