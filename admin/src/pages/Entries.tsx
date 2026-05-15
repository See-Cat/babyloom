import { useState } from 'react';
import { Table, Button, Input, Tag, Space, Modal, message } from 'antd';
import { SearchOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entryApi } from '../services/api';

export default function Entries() {
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['entries', page, pageSize, searchText],
    queryFn: () =>
      entryApi.getEntries({
        page,
        limit: pageSize,
        ...(searchText ? { search: searchText } : {}),
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: entryApi.deleteEntry,
    onSuccess: () => {
      message.success('删除成功');
      queryClient.invalidateQueries({ queryKey: ['entries'] });
    },
  });

  useMutation({
    mutationFn: entryApi.restoreEntry,
    onSuccess: () => {
      message.success('恢复成功');
      queryClient.invalidateQueries({ queryKey: ['entries'] });
    },
  });

  const entries = data?.data?.items || [];
  const total = data?.data?.total || 0;

  const columns = [
    {
      title: '内容',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      render: (text: string) => text.slice(0, 100) + (text.length > 100 ? '...' : ''),
    },
    {
      title: '作者',
      dataIndex: ['creator', 'nickname'],
      key: 'creator',
      width: 120,
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '里程碑',
      dataIndex: 'milestones',
      key: 'milestones',
      width: 200,
      render: (milestones: any[]) =>
        milestones?.map((m) => (
          <Tag key={m.id} color={m.color || '#ff8c69'}>
            {m.icon} {m.name}
          </Tag>
        )) || null,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: any) => (
        <Space>
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedEntry(record);
              setDetailVisible(true);
            }}
          />
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => {
              Modal.confirm({
                title: '确认删除',
                content: '确定要删除这条记录吗？',
                onOk: () => deleteMutation.mutate(record.id),
              });
            }}
          />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <Input.Search
          placeholder="搜索记录内容"
          value={searchText}
          onChange={(e: any) => setSearchText(e.target.value)}
          onSearch={() => setPage(1)}
          style={{ width: 300 }}
          prefix={<SearchOutlined />}
        />
      </div>

      <Table
        dataSource={entries}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: (p: any, ps: any) => {
            setPage(p);
            setPageSize(ps || 10);
          },
        }}
      />

      <Modal
        title="记录详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={600}
      >
        {selectedEntry && (
          <div>
            <p>{selectedEntry.content}</p>
            <div style={{ marginTop: 16 }}>
              {selectedEntry.milestones?.map((m: any) => (
                <Tag key={m.id} color={m.color || '#ff8c69'}>
                  {m.icon} {m.name}
                </Tag>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
