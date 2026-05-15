import { useState } from 'react';
import {
  Table,
  Button,
  Input,
  Modal,
  Form,
  Space,
  message,
  Popconfirm,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { milestoneApi } from '../services/api';

interface MilestoneFormData {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  sortOrder?: number;
}

export default function Milestones() {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<any>(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['milestones'],
    queryFn: () => milestoneApi.getMilestones(),
  });

  const createMutation = useMutation({
    mutationFn: milestoneApi.createMilestone,
    onSuccess: () => {
      message.success('创建成功');
      setIsModalVisible(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['milestones'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: MilestoneFormData }) =>
      milestoneApi.updateMilestone(id, data),
    onSuccess: () => {
      message.success('更新成功');
      setIsModalVisible(false);
      setEditingMilestone(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['milestones'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: milestoneApi.deleteMilestone,
    onSuccess: () => {
      message.success('删除成功');
      queryClient.invalidateQueries({ queryKey: ['milestones'] });
    },
  });

  const milestones = data?.data || [];

  const handleSubmit = (values: MilestoneFormData) => {
    if (editingMilestone) {
      updateMutation.mutate({ id: editingMilestone.id, data: values });
    } else {
      createMutation.mutate(values);
    }
  };

  const handleEdit = (milestone: any) => {
    setEditingMilestone(milestone);
    form.setFieldsValue(milestone);
    setIsModalVisible(true);
  };

  const handleAdd = () => {
    setEditingMilestone(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const columns = [
    {
      title: '图标',
      dataIndex: 'icon',
      key: 'icon',
      width: 80,
      render: (icon: string) => <span style={{ fontSize: 24 }}>{icon || '🏷️'}</span>,
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '颜色',
      dataIndex: 'color',
      key: 'color',
      width: 100,
      render: (color: string) =>
        color ? (
          <div
            style={{
              width: 24,
              height: 24,
              backgroundColor: color,
              borderRadius: 4,
              border: '1px solid #ddd',
            }}
          />
        ) : (
          '-'
        ),
    },
    {
      title: '排序',
      dataIndex: 'sortOrder',
      key: 'sortOrder',
      width: 80,
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (isActive: boolean) => (isActive ? '启用' : '禁用'),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: any) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="确认删除"
            description="确定要删除这个里程碑吗？"
            onConfirm={() => deleteMutation.mutate(record.id)}
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAdd}
          style={{ background: '#ff8c69', borderColor: '#ff8c69' }}
        >
          新增里程碑
        </Button>
      </div>

      <Table
        dataSource={milestones}
        columns={columns}
        rowKey="id"
        loading={isLoading}
      />

      <Modal
        title={editingMilestone ? '编辑里程碑' : '新增里程碑'}
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingMilestone(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        confirmLoading={
          createMutation.isPending || updateMutation.isPending}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input placeholder="例如：翻身、爬行、走路" />
          </Form.Item>

          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="可选描述" />
          </Form.Item>

          <Form.Item name="icon" label="图标">
            <Input placeholder="例如：👶、🏃、🦷" />
          </Form.Item>

          <Form.Item name="color" label="颜色">
            <Input type="color" />
          </Form.Item>

          <Form.Item name="sortOrder" label="排序">
            <Input type="number" placeholder="数字越小越靠前" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
