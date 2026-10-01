import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  Layout, 
  Card, 
  Typography, 
  Button, 
  Space, 
  Alert, 
  Spin, 
  Empty,
  message,
  Radio
} from 'antd'
import {
  ArrowLeftOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined
} from '@ant-design/icons'
import { useProjectStore, Clip, Collection } from '../store/useProjectStore'
import { projectApi } from '../services/api'
import ClipCard from '../components/ClipCard'
import CollectionCard from '../components/CollectionCard'
import CollectionPreviewModal from '../components/CollectionPreviewModal'
import CreateCollectionModal from '../components/CreateCollectionModal'
import { useCollectionVideoDownload } from '../hooks/useCollectionVideoDownload'
import { ProjectTaskManager } from '../components/ProjectTaskManager'

const { Content } = Layout
const { Title, Text } = Typography

const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { 
    currentProject, 
    loading, 
    error,
    setCurrentProject,
    upsertProject,
    updateCollection,
    addCollection,
    deleteCollection,
    removeClipFromCollection,
    reorderCollectionClips,
    addClipToCollection
  } = useProjectStore()
  
  const [statusLoading, setStatusLoading] = useState(false)
  const [showCreateCollection, setShowCreateCollection] = useState(false)
  const [sortBy, setSortBy] = useState<'time' | 'score'>('score')
  const [showCollectionDetail, setShowCollectionDetail] = useState(false)
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null)
  const [processingStatus, setProcessingStatus] = useState<{status?: string} | null>(null)
  const { generateAndDownloadCollectionVideo } = useCollectionVideoDownload()

  useEffect(() => {
    if (!id) return
    loadProject()
    loadProcessingStatus()
  }, [id])

  const loadProject = async () => {
    if (!id) return
    try {
      const project = await projectApi.getProject(id)
      
      // 如果项目已完成，加载clips和collections
      if (project.status === 'completed') {
        try {
          const [clips, collections] = await Promise.all([
            projectApi.getClips(id),
            projectApi.getCollections(id)
          ])
          
          console.log('🎬 Loaded clips in ProjectDetailPage:', clips)
          console.log('📚 Loaded collections in ProjectDetailPage:', collections)
          
          const projectWithData = {
            ...project,
            clips: clips || [],
            collections: collections || []
          }
          
          console.log('🎯 Final project with data:', projectWithData)
          setCurrentProject(projectWithData)
          
          // 同步更新项目列表，避免页面与列表状态漂移
          upsertProject(projectWithData)
        } catch (error) {
          console.error('Failed to load clips/collections:', error)
          // 即使clips/collections加载失败，也设置项目基本信息
          setCurrentProject(project)
        }
      } else {
        setCurrentProject(project)
      }
    } catch (error) {
      console.error('Failed to load project:', error)
      message.error('Falha ao carregar projeto')
    }
  }

  const loadProcessingStatus = async () => {
    if (!id) return
    setStatusLoading(true)
    try {
      await projectApi.getProcessingStatus(id)
    } catch (error) {
      console.error('Failed to load processing status:', error)
    } finally {
      setStatusLoading(false)
    }
  }

  const handleStartProcessing = async () => {
    if (!id) return
    try {
      await projectApi.startProcessing(id)
      message.success('Processamento iniciado')
      loadProcessingStatus()
      loadProjectLogs()
    } catch (error) {
      console.error('Failed to start processing:', error)
      message.error('Falha ao iniciar processamento')
    }
  }

  // --- Activity Logs & Retry ---
  const [projectLogs, setProjectLogs] = useState<Array<{timestamp: string; module: string; level: string; message: string; progress?: number; status?: string}>>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [retrying, setRetrying] = useState(false)

  const loadProjectLogs = async () => {
    if (!id) return
    setLogsLoading(true)
    try {
      const res = await projectApi.getProjectLogs(id, 100)
      setProjectLogs(res?.logs || [])
    } catch (error) {
      console.error('Failed to load project logs:', error)
    } finally {
      setLogsLoading(false)
    }
  }

  const handleRetryProcessing = async () => {
    if (!id) return
    setRetrying(true)
    try {
      await projectApi.retryProcessing(id)
      message.success('Processamento reiniciado')
      loadProcessingStatus()
      loadProjectLogs()
    } catch (error) {
      console.error('Failed to retry processing:', error)
      message.error('Falha ao reiniciar processamento')
    } finally {
      setRetrying(false)
    }
  }

  useEffect(() => {
    if (id) loadProjectLogs()
  }, [id])

  const handleCreateCollection = async (title: string, summary: string, clipIds: string[]) => {
    if (!id) return
    try {
      await addCollection(id, {
        id: `collection_${Date.now()}`,
        collection_title: title,
        collection_summary: summary,
        clip_ids: clipIds,
        collection_type: 'manual',
        created_at: new Date().toISOString()
      })
      setShowCreateCollection(false)
      message.success('Coleção criada com sucesso')
    } catch (error) {
      console.error('Failed to create collection:', error)
      message.error('Falha ao criar coleção')
    }
  }

  const handleViewCollection = (collection: Collection) => {
    setSelectedCollection(collection)
    setShowCollectionDetail(true)
  }

  const handleRemoveClipFromCollection = async (collectionId: string, clipId: string): Promise<void> => {
    if (!id) return
    try {
      await removeClipFromCollection(id, collectionId, clipId)
      message.success('Corte removido da coleção')
    } catch (error) {
      console.error('Failed to remove clip from collection:', error)
      message.error('Falha ao remover corte')
    }
  }

  const handleDeleteCollection = async (collectionId: string) => {
    if (!id) return
    try {
      await deleteCollection(id, collectionId)
      setShowCollectionDetail(false)
      setSelectedCollection(null)
      message.success('Coleção excluída com sucesso')
    } catch (error) {
      console.error('Failed to delete collection:', error)
      message.error('Falha ao excluir coleção')
    }
  }

  const handleReorderCollectionClips = async (collectionId: string, newClipIds: string[]): Promise<void> => {
    if (!id) return
    try {
      await reorderCollectionClips(id, collectionId, newClipIds)
      message.success('Ordem da coleção atualizada')
    } catch (error) {
      console.error('Failed to reorder collection clips:', error)
      message.error('Falha ao atualizar ordem da coleção')
    }
  }

  const handleAddClipToCollection = async (collectionId: string, clipIds: string[]): Promise<void> => {
    if (!id) return
    try {
      await addClipToCollection(id, collectionId, clipIds)
      message.success('Cortes adicionados à coleção')
    } catch (error) {
      console.error('Failed to add clip to collection:', error)
      message.error('Falha ao adicionar cortes à coleção')
    }
  }

  const getSortedClips = () => {
    if (!currentProject?.clips) return []
    const clips = [...currentProject.clips]
    
    if (sortBy === 'score') {
      return clips.sort((a, b) => b.final_score - a.final_score)
    } else {
      return clips.sort((a, b) => {
        const getTimeInSeconds = (timeStr: string) => {
          const parts = timeStr.split(':')
          const hours = parseInt(parts[0])
          const minutes = parseInt(parts[1])
          const seconds = parseFloat(parts[2].replace(',', '.'))
          return hours * 3600 + minutes * 60 + seconds
        }
        
        const aTime = getTimeInSeconds(a.start_time)
        const bTime = getTimeInSeconds(b.start_time)
        return aTime - bTime
      })
    }
  }

  if (loading) {
    return (
      <Content style={{ padding: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Spin size="large" />
      </Content>
    )
  }

  if (error || !currentProject) {
    return (
      <Content style={{ padding: '24px' }}>
        <Alert
          message="Falha ao carregar"
          description={error || 'Projeto não encontrado'}
          type="error"
          action={
            <Button size="small" onClick={() => navigate('/')}>
              Voltar ao Início
            </Button>
          }
        />
      </Content>
    )
  }

  return (
    <Content style={{ padding: '24px' }}>
      {/* 简化的项目头部 */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Button 
            type="link" 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate('/')}
            style={{ padding: 0, marginBottom: '8px' }}
          >
            Voltar para lista de projetos
          </Button>
          <Title level={2} style={{ margin: 0 }}>
            {currentProject.name}
          </Title>
        </div>
        
        <Space>
          {currentProject.status === 'pending' && (
            <Button 
              type="primary" 
              onClick={handleStartProcessing}
              loading={statusLoading}
            >
              Iniciar Processamento
            </Button>
          )}
        </Space>
      </div>

      {/* 主要内容 */}
      {currentProject.status === 'completed' ? (
        <div>
          {/* AI合集横向滚动区域 */}
          {currentProject.collections && currentProject.collections.length > 0 && (
            <Card style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <Title level={4} style={{ margin: 0 }}>Coleções Recomendadas por IA</Title>
                  <Text type="secondary">
                    A IA recomendou {currentProject.collections.length} coleções temáticas para este vídeo
                  </Text>
                </div>
                <Button 
                  type="primary" 
                  icon={<PlusOutlined />}
                  onClick={() => setShowCreateCollection(true)}
                  style={{
                    borderRadius: '8px',
                    background: 'var(--ac-accent)',
                    border: 'none',
                    fontWeight: 500,
                    height: '40px',
                    padding: '0 20px',
                    fontSize: '14px'
                  }}
                >
                  Criar Coleção
                </Button>
              </div>
              
              <div 
                className="collections-scroll-container"
                style={{ 
                  display: 'flex',
                  gap: '16px',
                  overflowX: 'auto',
                  paddingBottom: '8px'
                }}
              >
                {currentProject.collections
                  .sort((a, b) => {
                    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0
                    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0
                    return timeB - timeA
                  })
                  .map((collection) => (
                  <CollectionCard
                    key={collection.id}
                    collection={collection}
                    clips={currentProject.clips || []}
                    onView={handleViewCollection}
                    onUpdate={(collectionId, updates) => 
                      updateCollection(currentProject.id, collectionId, updates)
                    }
                    onGenerateVideo={async (collectionId) => {
                      const collection = currentProject.collections?.find(c => c.id === collectionId)
                      if (collection) {
                        await generateAndDownloadCollectionVideo(
                          currentProject.id, 
                          collectionId, 
                          collection.collection_title
                        )
                      }
                    }}
                    onDelete={handleDeleteCollection}
                  />
                ))}
              </div>
            </Card>
          )}
          
          {/* 视频片段区域 */}
          <Card 
            style={{
              borderRadius: '16px',
              border: '1px solid #303030',
              background: 'var(--ac-card)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <Title level={4} style={{ margin: 0, color: '#ffffff', fontWeight: 600 }}>Cortes do Vídeo</Title>
                <Text type="secondary" style={{ color: 'var(--ac-sub)', fontSize: '14px' }}>
                  A IA gerou {currentProject.clips?.length || 0} cortes destacados
                </Text>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Text style={{ fontSize: '13px', color: 'var(--ac-sub)', fontWeight: 500 }}>Ordenar por</Text>
                  <Radio.Group
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    size="small"
                    buttonStyle="solid"
                    style={{
                      ['--ant-radio-button-bg' as string]: 'transparent',
                      ['--ant-radio-button-checked-bg' as string]: '#1890ff',
                      ['--ant-radio-button-color' as string]: 'var(--ac-sub)',
                      ['--ant-radio-button-checked-color' as string]: '#ffffff'
                    }}
                  >
                    <Radio.Button 
                       value="time" 
                       style={{ 
                         fontSize: '13px',
                         height: '32px',
                         lineHeight: '30px',
                         padding: '0 16px',
                         background: sortBy === 'time' ? 'var(--ac-cta-bg)' : 'var(--ac-line)',
                         border: sortBy === 'time' ? '1px solid #1890ff' : '1px solid var(--ac-line)',
                         color: sortBy === 'time' ? '#ffffff' : 'var(--ac-sub)',
                         borderRadius: '6px 0 0 6px',
                         fontWeight: sortBy === 'time' ? 600 : 400,
                         boxShadow: sortBy === 'time' ? '0 2px 8px rgba(24, 144, 255, 0.3)' : 'none',
                         transition: 'all 0.2s ease'
                       }}
                     >
                       Tempo
                     </Radio.Button>
                     <Radio.Button 
                       value="score" 
                       style={{ 
                         fontSize: '13px',
                         height: '32px',
                         lineHeight: '30px',
                         padding: '0 16px',
                         background: sortBy === 'score' ? 'var(--ac-cta-bg)' : 'var(--ac-line)',
                         border: sortBy === 'score' ? '1px solid #1890ff' : '1px solid var(--ac-line)',
                         borderLeft: 'none',
                         color: sortBy === 'score' ? '#ffffff' : 'var(--ac-sub)',
                         borderRadius: '0 6px 6px 0',
                         fontWeight: sortBy === 'score' ? 600 : 400,
                         boxShadow: sortBy === 'score' ? '0 2px 8px rgba(24, 144, 255, 0.3)' : 'none',
                         transition: 'all 0.2s ease'
                       }}
                     >
                       Pontuação
                     </Radio.Button>
                  </Radio.Group>
                </div>
                
                <Space>
                  {(!currentProject.collections || currentProject.collections.length === 0) && (
                    <Button 
                      type="primary" 
                      icon={<PlusOutlined />}
                      onClick={() => setShowCreateCollection(true)}
                      style={{
                        borderRadius: '8px',
                        background: 'var(--ac-accent)',
                        border: 'none',
                        fontWeight: 500,
                        height: '40px',
                        padding: '0 20px',
                        fontSize: '14px'
                      }}
                    >
                      Criar Coleção
                    </Button>
                  )}
                </Space>
              </div>
            </div>
            
            {currentProject.clips && currentProject.clips.length > 0 ? (
              <div 
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: '20px',
                  padding: '8px 0'
                }}
              >
                {getSortedClips().map((clip) => (
                  <ClipCard
                    key={clip.id}
                    clip={clip}
                    projectId={currentProject.id}
                    videoUrl={projectApi.getClipVideoUrl(currentProject.id, clip.id, clip.title || clip.generated_title)}
                    onDownload={(clipId) => projectApi.downloadVideo(currentProject.id, clipId)}
                    onClipUpdate={(clipId: string, updates: Partial<Clip>) => {
                      if (currentProject) {
                        const updatedProject = {
                          ...currentProject,
                          clips: currentProject.clips?.map((c: Clip) => 
                            c.id === clipId ? { ...c, ...updates } : c
                          ) || []
                        }
                        setCurrentProject(updatedProject)
                      }
                    }}
                  />
                ))}
              </div>
            ) : (
              <div style={{ 
                padding: '60px 0',
                textAlign: 'center',
                background: 'var(--ac-line)',
                borderRadius: '12px',
                border: '1px dashed var(--ac-line)'
              }}>
                <Empty 
                  description={
                    <Text style={{ color: '#888', fontSize: '14px' }}>Nenhum corte encontrado</Text>
                  }
                  image={<PlayCircleOutlined style={{ fontSize: '48px', color: '#555' }} />}
                />
              </div>
            )}
          </Card>
        </div>
      ) : (
        <div>
          {/* 任务管理组件 */}
          <ProjectTaskManager
            projectId={currentProject.id}
            projectName={currentProject.name}
          />

          {/* Activity Logs Section */}
          <Card
            style={{
              marginTop: '16px',
              background: 'var(--ac-surface)',
              border: '1px solid var(--ac-line)',
              borderRadius: '12px'
            }}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileTextOutlined style={{ color: 'var(--ac-accent)' }} />
                <span style={{ color: '#ffffff', fontWeight: 600 }}>Log de Atividades</span>
              </div>
            }
            extra={
              <Button
                icon={<ReloadOutlined spin={retrying} />}
                loading={retrying}
                onClick={handleRetryProcessing}
                disabled={processingStatus?.status === 'running' || processingStatus?.status === 'pending'}
                style={{
                  borderRadius: '8px',
                  borderColor: 'var(--ac-line)',
                  color: 'var(--ac-sub)',
                  background: 'transparent'
                }}
              >
                Reiniciar Processamento
              </Button>
            }
          >
            <div style={{
              maxHeight: '320px',
              overflowY: 'auto',
              padding: '4px 0',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              {logsLoading ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--ac-sub)' }}>Carregando eventos...</div>
              ) : projectLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--ac-sub)' }}>Nenhum evento registrado</div>
              ) : (
                projectLogs.map((log, idx) => {
                  const isError = log.level === 'ERROR'
                  const isSuccess = log.level === 'SUCCESS'
                  const Icon = isError ? CloseCircleOutlined : isSuccess ? CheckCircleOutlined : InfoCircleOutlined
                  const iconColor = isError ? '#ff4d4f' : isSuccess ? '#52c41a' : 'var(--ac-accent)'
                  return (
                    <div
                      key={`${log.timestamp}-${idx}`}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: isError ? 'rgba(255,77,79,0.08)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${isError ? 'rgba(255,77,79,0.2)' : 'var(--ac-line)'}`
                      }}
                    >
                      <Icon style={{ color: iconColor, marginTop: '3px', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                          <Text style={{ color: '#ffffff', fontSize: '13px', fontWeight: 500 }}>{log.message}</Text>
                          <Text style={{ color: 'var(--ac-sub)', fontSize: '11px', flexShrink: 0 }}>
                            {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ''}
                          </Text>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <Text style={{ color: 'var(--ac-sub)', fontSize: '11px' }}>{log.module}</Text>
                          {typeof log.progress === 'number' && log.progress > 0 && (
                            <Text style={{ color: 'var(--ac-accent)', fontSize: '11px' }}>{Math.round(log.progress)}%</Text>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </Card>

          {/* 项目状态提示 */}
          <Card style={{ marginTop: '16px' }}>
            <Empty 
              image={<PlayCircleOutlined style={{ fontSize: '64px', color: '#d9d9d9' }} />}
              description={
                <div>
                  <Text>O projeto ainda está sendo processado</Text>
                  <br />
                  <Text type="secondary">Assim que concluído, os cortes e coleções da IA aparecerão aqui</Text>
                </div>
              }
            />
          </Card>
        </div>
      )}

      {/* 创建合集模态框 */}
      <CreateCollectionModal
        visible={showCreateCollection}
        clips={currentProject.clips || []}
        onCancel={() => setShowCreateCollection(false)}
        onCreate={handleCreateCollection}
      />
      
      {/* 合集预览模态框 */}
      <CollectionPreviewModal
        visible={showCollectionDetail}
        collection={selectedCollection}
        clips={currentProject.clips || []}
        projectId={currentProject.id}
        onClose={() => {
          setShowCollectionDetail(false)
          setSelectedCollection(null)
        }}
        onUpdateCollection={(collectionId, updates) => 
          updateCollection(currentProject.id, collectionId, updates)
        }
        onRemoveClip={handleRemoveClipFromCollection}
        onReorderClips={handleReorderCollectionClips}
        onDelete={handleDeleteCollection}
        onAddClip={handleAddClipToCollection}
      />

    </Content>
  )
}

export default ProjectDetailPage