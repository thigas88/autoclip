import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Layout, Card, Progress, Steps, Typography, Button, Alert, Space, Spin, message } from 'antd'
import { CheckCircleOutlined, LoadingOutlined, ExclamationCircleOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { projectApi } from '../services/api'
import { useProjectStore } from '../store/useProjectStore'

const { Content } = Layout
const { Title, Text } = Typography
const { Step } = Steps

interface ProcessingStatus {
  status: 'processing' | 'completed' | 'error'
  current_step: number
  total_steps: number
  step_name: string
  progress: number
  error_message?: string
}

const ProcessingPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentProject, setCurrentProject } = useProjectStore()
  const [status, setStatus] = useState<ProcessingStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const steps = [
    { title: 'Extração de roteiro', description: 'Extrai o roteiro estrutural do texto transcrito do vídeo' },
    { title: 'Localização temporal', description: 'Localiza intervalos de tempo dos tópicos com base nas legendas SRT' },
    { title: 'Pontuação de conteúdo', description: 'Avalia a qualidade e o potencial viral dos clipes em múltiplas dimensões' },
    { title: 'Geração de títulos', description: 'Gera títulos atraentes para os clipes com maior pontuação' },
    { title: 'Agrupamento por tema', description: 'Agrupa clipes relacionados em coleções recomendadas' },
    { title: 'Corte de vídeo', description: 'Usa FFmpeg para gerar os cortes e vídeos de coleção' }
  ]

  useEffect(() => {
    if (!id) return

    loadProject()
    const interval = setInterval(checkStatus, 2000)

    return () => clearInterval(interval)
  }, [id])

  const loadProject = async () => {
    if (!id) return

    try {
      const project = await projectApi.getProject(id)
      setCurrentProject(project)

      if (project.status === 'completed') {
        navigate(`/project/${id}`)
        return
      }

      if (project.status === 'pending') {
        await startProcessing()
      }
    } catch (error) {
      message.error('Falha ao carregar o projeto')
      console.error('Load project error:', error)
    } finally {
      setLoading(false)
    }
  }

  const startProcessing = async () => {
    if (!id) return

    try {
      await projectApi.startProcessing(id)
      message.success('Processamento iniciado')
    } catch (error) {
      message.error('Falha ao iniciar o processamento')
      console.error('Start processing error:', error)
    }
  }

  const checkStatus = async () => {
    if (!id) return

    try {
      const statusData = await projectApi.getProcessingStatus(id)
      setStatus(statusData)

      if (statusData.status === 'completed') {
        message.success('🎉 Processamento concluído! Redirecionando para a página de resultados...')
        setTimeout(() => {
          navigate(`/project/${id}`)
        }, 2000)
      }

      if (statusData.status === 'error') {
        const errorMsg = statusData.error_message || 'Ocorreu um erro desconhecido durante o processamento'
        message.error(`Falha no processamento: ${errorMsg}`)
        message.info('Você pode voltar à página inicial para reenviar o arquivo ou entrar em contato com o suporte', 5)
      }

    } catch (error: any) {
      console.error('Check status error:', error)

      if (error.response?.status === 404) {
        message.error('O projeto não existe ou foi excluído')
        setTimeout(() => navigate('/'), 2000)
      } else if (error.code === 'ECONNABORTED') {
        message.warning('Tempo de conexão esgotado, tentando novamente...')
      } else {
        message.error('Falha ao obter o status do processamento, atualize a página e tente novamente')
      }
    }
  }

  const getStepStatus = (stepIndex: number) => {
    if (!status) return 'wait'

    if (status.status === 'error') {
      return stepIndex < status.current_step ? 'finish' : 'error'
    }

    if (stepIndex < status.current_step) return 'finish'
    if (stepIndex === status.current_step) return 'process'
    return 'wait'
  }

  const getStepIcon = (stepIndex: number) => {
    const stepStatus = getStepStatus(stepIndex)

    if (stepStatus === 'finish') return <CheckCircleOutlined />
    if (stepStatus === 'process') return <LoadingOutlined />
    if (stepStatus === 'error') return <ExclamationCircleOutlined />
    return null
  }

  if (loading) {
    return (
      <Content style={{ padding: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Spin size="large" tip="Carregando..." />
      </Content>
    )
  }

  return (
    <Content style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Title level={2}>Progresso do processamento</Title>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/')}
          >
            Voltar ao início
          </Button>
        </div>

        {currentProject && (
          <Card>
            <Title level={4}>{currentProject.name}</Title>
            <Text type="secondary">ID do projeto: {currentProject.id}</Text>
          </Card>
        )}

        {status?.status === 'error' && (
          <Alert
            message="Falha no processamento"
            description={
              <div>
                <p>{status.error_message || 'Ocorreu um erro desconhecido durante o processamento'}</p>
                <p style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                  Possíveis causas: formato de arquivo não suportado, arquivo corrompido, problema de rede ou erro no servidor
                </p>
              </div>
            }
            type="error"
            showIcon
            action={
              <Space>
                <Button size="small" onClick={() => window.location.reload()}>
                  Atualizar página
                </Button>
                <Button size="small" onClick={() => navigate('/')}>
                  Voltar ao início
                </Button>
              </Space>
            }
          />
        )}

        {status && status.status === 'processing' && (
          <Card title="Progresso do processamento">
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <Text strong>Progresso geral</Text>
                  <Text>{Math.round(status.progress)}%</Text>
                </div>
                <Progress
                  percent={status.progress}
                  status="active"
                  strokeColor={{
                    '0%': '#108ee9',
                    '100%': '#87d068',
                  }}
                />
              </div>

              <div>
                <Text strong>Etapa atual: </Text>
                <Text>{status.step_name}</Text>
              </div>

              <Steps
                direction="vertical"
                current={status.current_step}
                status="process"
              >
                {steps.map((step, index) => (
                  <Step
                    key={index}
                    title={step.title}
                    description={step.description}
                    status={getStepStatus(index)}
                    icon={getStepIcon(index)}
                  />
                ))}
              </Steps>
            </Space>
          </Card>
        )}

        {status?.status === 'completed' && (
          <Alert
            message="Processamento concluído"
            description="O vídeo foi processado com sucesso. Redirecionando para a página de detalhes do projeto..."
            type="success"
            showIcon
          />
        )}
      </Space>
    </Content>
  )
}

export default ProcessingPage