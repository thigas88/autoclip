import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert, Button, Card, Progress, Tag, Space, Typography, message, List, Popconfirm, Spin, Tooltip,
} from 'antd'
import {
  DownloadOutlined, DeleteOutlined, CheckCircleFilled, ReloadOutlined, ThunderboltOutlined,
} from '@ant-design/icons'
import { speechApi, WhisperRuntimeStatus, WhisperModel } from '../services/api'

const { Text, Paragraph } = Typography

interface SpeechRecognitionConfigProps {
  config?: Record<string, unknown>
  onConfigChange?: (config: Record<string, unknown>) => void
}

const accuracyColor: Record<string, string> = {
  'Máxima': 'green', 'Alta': 'green', 'Boa': 'blue', 'Média': 'gold', 'Baixa': 'default',
}

const SpeechRecognitionConfig: React.FC<SpeechRecognitionConfigProps> = () => {
  const [runtime, setRuntime] = useState<WhisperRuntimeStatus | null>(null)
  const [models, setModels] = useState<WhisperModel[]>([])
  const [loading, setLoading] = useState(true)
  const timer = useRef<number | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [rt, ms] = await Promise.all([speechApi.getRuntimeStatus(), speechApi.getModels()])
      setRuntime(rt)
      setModels(Array.isArray(ms) ? ms : [])
    } catch (e) {
      // Backend may not be ready yet, retry silently
    } finally {
      setLoading(false)
    }
  }, [])

  // Poll faster when installing or downloading models
  const needsFastPoll = (rt: WhisperRuntimeStatus | null, ms: WhisperModel[]) =>
    rt?.status === 'installing' || ms.some((m) => m.status === 'downloading')

  useEffect(() => {
    refresh()
    return () => { if (timer.current) window.clearInterval(timer.current) }
  }, [refresh])

  useEffect(() => {
    if (timer.current) window.clearInterval(timer.current)
    const interval = needsFastPoll(runtime, models) ? 2000 : 15000
    timer.current = window.setInterval(refresh, interval)
    return () => { if (timer.current) window.clearInterval(timer.current) }
  }, [runtime, models, refresh])

  const handleInstall = async () => {
    try {
      const r = await speechApi.installRuntime()
      message.info(r.message || 'Instalação iniciada')
      setRuntime((p) => (p ? { ...p, status: 'installing', progress: 5 } : p))
      refresh()
    } catch (e: any) {
      message.error(e?.response?.data?.detail || 'Falha na instalação')
    }
  }

  const handleUninstall = async () => {
    try {
      const r = await speechApi.uninstallRuntime()
      message.success(r.message || 'Desinstalado com sucesso')
      refresh()
    } catch (e: any) {
      message.error('Falha na desinstalação')
    }
  }

  const handleDownload = async (model: string) => {
    try {
      await speechApi.downloadModel(model)
      message.info(`Iniciando download do modelo ${model}`)
      setModels((prev) => prev.map((m) => (m.name === model ? { ...m, status: 'downloading' } : m)))
      refresh()
    } catch (e: any) {
      message.error(e?.response?.data?.detail || 'Falha no download')
    }
  }

  const handleDelete = async (model: string) => {
    try {
      await speechApi.deleteModel(model)
      message.success(`Modelo ${model} excluído`)
      refresh()
    } catch (e) {
      message.error('Falha ao excluir modelo')
    }
  }

  if (loading) return <Spin />

  const installed = runtime?.status === 'installed'
  const installing = runtime?.status === 'installing'
  const supported = runtime?.platform_supported !== false

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="Quando o Whisper é necessário?"
        description="Quando o vídeo importado já possui legendas embutidas ou automáticas, elas serão utilizadas diretamente. O Whisper local é necessário apenas para vídeos sem legendas, convertendo o áudio em texto com IA."
      />

      {!supported && (
        <Alert type="warning" showIcon message="Plataforma não suportada"
          description="Whisper é suportado em Linux (openai-whisper) e macOS Apple Silicon (mlx-whisper)." />
      )}

      {/* Runtime */}
      <Card size="small" title={<Space><ThunderboltOutlined />Ambiente de Execução Whisper</Space>}>
        {installed && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space>
              <CheckCircleFilled style={{ color: '#52c41a' }} />
              <Text strong>Instalado</Text>
              <Text type="secondary">({(runtime?.packages || []).join(', ')})</Text>
            </Space>
            <Popconfirm title="Desinstalar o ambiente Whisper? Os modelos baixados serão preservados." onConfirm={handleUninstall} okText="Desinstalar" cancelText="Cancelar">
              <Button danger size="small" icon={<DeleteOutlined />}>Desinstalar Ambiente</Button>
            </Popconfirm>
          </Space>
        )}

        {installing && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text>Instalando… {runtime?.message}</Text>
            <Progress percent={runtime?.progress ?? 5} status="active" />
            {runtime?.log_tail && (
              <pre style={{ maxHeight: 120, overflow: 'auto', background: '#1a1a1a', color: '#bbb', padding: 8, fontSize: 11, borderRadius: 4, margin: 0 }}>
                {runtime.log_tail}
              </pre>
            )}
          </Space>
        )}

        {runtime?.status === 'not_installed' && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Paragraph type="secondary" style={{ marginBottom: 8 }}>
              Não instalado. A instalação baixará o pacote faster-whisper (cerca de 200–400MB). Em seguida, selecione e baixe um modelo abaixo para começar.
            </Paragraph>
            <Button type="primary" icon={<DownloadOutlined />} onClick={handleInstall} disabled={!supported}>
              Instalar Whisper
            </Button>
          </Space>
        )}

        {runtime?.status === 'error' && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Alert type="error" showIcon message="Erro na instalação" description={runtime?.message} />
            <Button icon={<ReloadOutlined />} onClick={handleInstall} disabled={!supported}>Tentar Novamente</Button>
          </Space>
        )}
      </Card>

      {/* Models */}
      <Card size="small" title="Modelos Whisper">
        {!installed && (
          <Text type="secondary">Instale primeiro o ambiente Whisper para gerenciar e baixar os modelos.</Text>
        )}
        {installed && (
          <List
            dataSource={models}
            renderItem={(m) => {
              const downloaded = m.status === 'downloaded'
              const downloading = m.status === 'downloading'
              return (
                <List.Item
                  actions={[
                    downloaded ? (
                      <Popconfirm title={`Excluir modelo ${m.name}?`} onConfirm={() => handleDelete(m.name)} okText="Excluir" cancelText="Cancelar">
                        <Button size="small" danger icon={<DeleteOutlined />}>Excluir</Button>
                      </Popconfirm>
                    ) : downloading ? (
                      <Button size="small" loading disabled>Baixando</Button>
                    ) : (
                      <Button size="small" type="primary" icon={<DownloadOutlined />} onClick={() => handleDownload(m.name)}>
                        Baixar
                      </Button>
                    ),
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <Text strong>{m.name}</Text>
                        <Text type="secondary">{m.size}</Text>
                        {downloaded && <Tag color="green">Baixado</Tag>}
                        <Tag color={accuracyColor[m.accuracy] || 'default'}>Precisão: {m.accuracy}</Tag>
                        <Tooltip title="Velocidade"><Tag>{m.speed}</Tag></Tooltip>
                      </Space>
                    }
                    description={
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <Text type="secondary">{m.description}</Text>
                        {downloading && <Progress percent={m.downloadProgress ?? undefined} status="active" />}
                        {m.status === 'error' && m.errorMessage && <Text type="danger">{m.errorMessage}</Text>}
                      </Space>
                    }
                  />
                </List.Item>
              )
            }}
          />
        )}
      </Card>
    </Space>
  )
}

export default SpeechRecognitionConfig