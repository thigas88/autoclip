import React, { useEffect, useState, useCallback } from 'react';
import { Card, Row, Col, Statistic, Button } from 'antd';
import TaskProgress from './TaskProgress';
import { NotificationList } from './NotificationList';
import { useNotifications } from '../hooks/useNotifications';
import { useProjectStore } from '../store/useProjectStore';

interface RealTimeStatusProps {
  userId: string;
  projectId?: string;
}

export const RealTimeStatus: React.FC<RealTimeStatusProps> = ({ userId, projectId }) => {
  const currentProject = useProjectStore((state) => state.currentProject);
  
  const [tasks, setTasks] = useState<
    Array<{
      id: string;
      status: string;
      progress: number;
      message: string;
      updatedAt: string;
      project_id?: string;
    }>
  >([]);
  const [loading, setLoading] = useState(false);
  
  // Usar gerenciamento de estado simples, sem Hooks complexos
  const loadProjectTasks = useCallback(async (projectId: string) => {
    console.log('📤 Iniciando carregamento de tarefas do projeto:', projectId);
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/tasks/project/${projectId}`);
      console.log('📡 Status da resposta da API:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        const projectTasks = data.items || []; // Usar nome de campo correto
        console.log('📋 Tarefas obtidas:', projectTasks.length);
        
        // Converter para formato esperado pelo componente TaskProgress
        const formattedTasks = projectTasks.map((task: any) => ({
          id: task.id,
          status: task.status,
          progress: task.progress || 0,
          message: task.name || `Tarefa ${task.id}`, // Usar campo name ou valor padrão
          updatedAt: task.created_at || task.updated_at || new Date().toISOString(),
          project_id: task.project_id // Adicionar campo project_id
        }));
        
        setTasks(formattedTasks);
      } else {
        console.error('❌ Chamada à API falhou:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('❌ Falha ao carregar tarefas do projeto:', error);
    } finally {
      setLoading(false);
      console.log('✅ Carregamento de tarefas concluído');
    }
  }, []);

  const {
    notifications,
    unreadCount,
    markAsRead,
    removeNotification,
    markAllAsRead,
    clearAll: clearAllNotifications
  } = useNotifications();

  // Carregar tarefas do projeto
  useEffect(() => {
    const activeProjectId = projectId || currentProject?.id;
    if (!activeProjectId) {
      setTasks([]);
      return;
    }
    console.log('🔄 Iniciando carregamento de tarefas do projeto:', activeProjectId);
    loadProjectTasks(activeProjectId);
  }, [projectId, currentProject?.id, loadProjectTasks]);

  return (
    <div style={{ padding: 16 }}>
      <Row gutter={[16, 16]}>
        {/* Estatísticas */}
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Total de tarefas"
              value={tasks.length}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Status de carregamento"
              value={loading ? 'Carregando' : 'Concluído'}
              valueStyle={{ color: loading ? '#52c41a' : '#999' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Notificações não lidas"
              value={unreadCount}
              valueStyle={{ color: unreadCount > 0 ? '#ff4d4f' : '#999' }}
            />
          </Card>
        </Col>

        {/* Progresso das tarefas */}
        <Col span={12}>
          <Card 
            title="Progresso das tarefas" 
            size="small"
            extra={
              <Button size="small" onClick={() => setTasks([])}>
                Limpar
              </Button>
            }
          >
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {tasks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>
                  Nenhuma tarefa
                </div>
              ) : (
                tasks.map((task) => (
                  <TaskProgress 
                    key={task.id} 
                    projectId={task.project_id || userId}
                    taskId={task.id}
                    status={task.status === 'running' ? 'processing' : task.status}
                  />
                ))
              )}
            </div>
          </Card>
        </Col>

        {/* Lista de notificações */}
        <Col span={12}>
          <NotificationList
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkAsRead={markAsRead}
            onRemove={removeNotification}
            onMarkAllAsRead={markAllAsRead}
            onClearAll={clearAllNotifications}
            maxHeight={300}
          />
        </Col>
      </Row>
    </div>
  );
}; 
