import React, { useState, useEffect } from 'react'
import { Layout, Card, Form, Input, Button, Typography, Space, Alert, Divider, Row, Col, Tabs, message, Select, Tag, Switch } from 'antd'
import { KeyOutlined, SaveOutlined, ApiOutlined, SettingOutlined, InfoCircleOutlined, UserOutlined, RobotOutlined, SoundOutlined, PoweroffOutlined } from '@ant-design/icons'
import { settingsApi } from '../services/api'
import BilibiliManager from '../components/BilibiliManager'
import SpeechRecognitionConfig from '../components/SpeechRecognitionConfig'
import { isDesktopMode } from '../utils/desktopMode'
import { trackApiKeyConfigured } from '../analytics/events'
import { isAnalyticsEnabled, setAnalyticsEnabled } from '../analytics/posthog'
import './SettingsPage.css'

const { Content } = Layout
const { Title, Text, Paragraph } = Typography
const { TabPane } = Tabs

const SettingsPage: React.FC = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [showBilibiliManager, setShowBilibiliManager] = useState(false)
  const [currentProvider, setCurrentProvider] = useState<any>({})
  const [selectedProvider, setSelectedProvider] = useState('dashscope')
  const [analyticsOn, setAnalyticsOn] = useState(isAnalyticsEnabled())

  // 提供商配置
  const providerConfig = {
    dashscope: {
      name: 'Qwen (Alibaba DashScope)',
      icon: <RobotOutlined />,
      color: '#1890ff',
      description: 'Serviço de modelos Qwen da Alibaba Cloud',
      apiKeyField: 'dashscope_api_key',
      placeholder: 'Insira sua chave de API DashScope'
    },
    openai: {
      name: 'OpenAI',
      icon: <RobotOutlined />,
      color: '#52c41a',
      description: 'Modelos GPT da OpenAI',
      apiKeyField: 'openai_api_key',
      placeholder: 'Insira sua chave de API OpenAI'
    },
    gemini: {
      name: 'Google Gemini',
      icon: <RobotOutlined />,
      color: '#faad14',
      description: 'Modelos Google Gemini',
      apiKeyField: 'gemini_api_key',
      placeholder: 'Insira sua chave de API Gemini'
    },
    siliconflow: {
      name: 'SiliconFlow',
      icon: <RobotOutlined />,
      color: '#722ed1',
      description: 'Serviço de modelos SiliconFlow',
      apiKeyField: 'siliconflow_api_key',
      placeholder: 'Insira sua chave de API SiliconFlow'
    },
    custom: {
      name: 'OpenAI Compatible (Custom)',
      icon: <ApiOutlined />,
      color: '#13c2c2',
      description: 'Qualquer API compatível com OpenAI',
      apiKeyField: 'custom_api_key',
      placeholder: 'Insira a chave de API do seu provider'
    }
  }

  // 加载数据
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // 检查是否在Desktop模式下运行
      const isDesktop = await isDesktopMode()
      
      if (isDesktop) {
        // Desktop模式：调用完整的API
        const [settings, models, provider] = await Promise.allSettled([
          settingsApi.getSettings(),
          settingsApi.getAvailableModels(),
          settingsApi.getCurrentProvider()
        ])
        
        // 检查是否有失败的请求
        const failedRequests = [settings, models, provider].filter(result => result.status === 'rejected')
        if (failedRequests.length > 0) {
          console.warn('Algumas requisições falharam:', failedRequests.map(r => (r as PromiseRejectedResult).reason))
        }
        
        // 处理设置数据
        const settingsData = settings.status === 'fulfilled' ? settings.value : {}
        
        // 处理模型数据
        const modelsData = models.status === 'fulfilled' ? models.value.models : {}
        
        // 处理提供商数据
        const providerData = provider.status === 'fulfilled'
          ? provider.value
          : { available: false, provider: 'dashscope', display_name: 'Qwen', model: 'qwen-plus' }
        const providerName = providerData.provider || 'dashscope'
        setCurrentProvider(providerData)
        
        // 将嵌套的settings结构转换为扁平结构
        const flatSettings = {
          llm_provider: providerName,
          dashscope_api_key: settingsData.api?.api_keys?.dashscope || '',
          openai_api_key: settingsData.api?.api_keys?.openai || '',
          gemini_api_key: settingsData.api?.api_keys?.gemini || '',
          siliconflow_api_key: settingsData.api?.api_keys?.siliconflow || '',
          custom_api_key: settingsData.api?.api_keys?.custom || '',
          custom_base_url: settingsData.api?.custom_base_url || '',
          custom_api_style: settingsData.api?.custom_api_style || 'openai',
          jimeng_access_key: settingsData.api?.api_keys?.jimeng_access || '',
          jimeng_secret_key: settingsData.api?.api_keys?.jimeng_secret || '',
          model_name: settingsData.api?.api_model || 'qwen-plus',
          chunk_size: settingsData.processing?.processing_chunk_size || 5000,
          min_score_threshold: settingsData.processing?.processing_min_score || 0.7,
          max_clips_per_collection: settingsData.processing?.processing_max_clips || 5
        }
        
        setSelectedProvider(providerName)
        form.setFieldsValue(flatSettings)
      } else {
        const flatSettings = {
          llm_provider: 'dashscope',
          dashscope_api_key: '',
          openai_api_key: '',
          gemini_api_key: '',
          siliconflow_api_key: '',
          custom_api_key: '',
          custom_base_url: '',
          custom_api_style: 'openai',
          jimeng_access_key: '',
          jimeng_secret_key: '',
          model_name: 'qwen-plus',
          chunk_size: 5000,
          min_score_threshold: 0.7,
          max_clips_per_collection: 5
        }
        
        setSelectedProvider('dashscope')
        form.setFieldsValue(flatSettings)
        
        setCurrentProvider({
          available: false,
          provider: 'dashscope',
          display_name: 'Qwen',
          model: 'qwen-plus'
        })
      }
    } catch (error) {
      console.error('Falha ao carregar dados:', error)
    }
  }

  // 保存配置
  const handleSave = async (values: any) => {
    try {
      setLoading(true)
      
      const isDesktop = await isDesktopMode()
      
      if (!isDesktop) {
        message.info('No modo Web as configurações são salvas temporariamente')
        setLoading(false)
        return
      }
      
      let existingSettings = null
      try {
        existingSettings = await settingsApi.getSettings()
      } catch (error) {
        console.warn('Falha ao obter configurações existentes:', error)
      }
      
      const existingApiKeys = existingSettings?.api?.api_keys || {}
      
      const backendSettings = {
        basic: {
          app_name: "AutoClip Desktop",
          app_version: "1.0.0",
          debug_mode: false,
          auto_start: true
        },
        service: {
          host: "127.0.0.1",
          port: 8000,
          max_memory_usage: 2048
        },
        api: {
          api_keys: {
            dashscope: values.dashscope_api_key || existingApiKeys.dashscope || "",
            openai: values.openai_api_key || existingApiKeys.openai || "",
            gemini: values.gemini_api_key || existingApiKeys.gemini || "",
            siliconflow: values.siliconflow_api_key || existingApiKeys.siliconflow || "",
            custom: values.custom_api_key || existingApiKeys.custom || "",
            jimeng_access: values.jimeng_access_key || existingApiKeys.jimeng_access || "",
            jimeng_secret: values.jimeng_secret_key || existingApiKeys.jimeng_secret || ""
          },
          api_model: values.model_name || "qwen-plus",
          api_max_tokens: 4096,
          api_timeout: 30,
          custom_base_url: values.custom_base_url || "",
          custom_api_style: values.custom_api_style || "openai"
        },
        processing: {
          processing_chunk_size: values.chunk_size || 5000,
          processing_min_score: values.min_score_threshold || 0.7,
          processing_max_clips: values.max_clips_per_collection || 5,
          processing_max_retries: 3
        },
        logs: {
          log_level: "INFO",
          log_retention_days: 7
        },
        paths: {
          data_directory: "/app/data",
          cache_directory: "/app/data/cache",
          temp_directory: "/app/data/temp"
        }
      }
      
      await settingsApi.updateSettings(backendSettings)
      message.success('Configurações salvas com sucesso!')

      const apiKeyField = providerConfig[selectedProvider as keyof typeof providerConfig]?.apiKeyField
      if (apiKeyField) {
        trackApiKeyConfigured({
          provider: selectedProvider,
          hasKey: !!values[apiKeyField],
        })
      }

      await loadData()
    } catch (error: any) {
      message.error('Falha ao salvar: ' + (error.message || 'Erro desconhecido'))
    } finally {
      setLoading(false)
    }
  }

  // 测试API密钥
  const handleTestApiKey = async () => {
    const apiKey = form.getFieldValue(providerConfig[selectedProvider as keyof typeof providerConfig].apiKeyField)
    
    if (!apiKey || apiKey.trim() === '') {
      message.error('Por favor, informe primeiro a chave de API')
      return
    }

    try {
      setLoading(true)
      // model_name usa mode="tags" (array); envia apenas a primeira string para o backend
      const rawModel = form.getFieldValue('model_name')
      const modelName = Array.isArray(rawModel) ? (rawModel[0] || '') : (rawModel || '')
      const options = selectedProvider === 'custom' ? {
        base_url: form.getFieldValue('custom_base_url'),
        api_style: form.getFieldValue('custom_api_style'),
        model_name: modelName
      } : undefined
      const result = await settingsApi.testApiKey(selectedProvider, apiKey, options)
      if (result.success) {
        message.success('Teste de conexão com a API realizado com sucesso!')
      } else {
        message.error('Falha no teste da API: ' + (result.error || 'Erro desconhecido'))
      }
    } catch (error: any) {
      message.error('Falha no teste: ' + (error.message || 'Erro desconhecido'))
    } finally {
      setLoading(false)
    }
  }

  // 提供商切换
  const handleProviderChange = (provider: string) => {
    setSelectedProvider(provider)
    form.setFieldsValue({ llm_provider: provider })
  }

  return (
    <Content className="settings-page">
      <div className="settings-container">
        <Title level={2} className="settings-title">
          <SettingOutlined /> Configurações do Sistema
        </Title>
        
        <Tabs defaultActiveKey="api" className="settings-tabs">
          <TabPane tab="Modelos de IA" key="api">
            <Card title="Configuração de Modelos de IA" className="settings-card">
              <Alert
                message="Suporte a múltiplos provedores de IA"
                description="O sistema suporta múltiplos provedores de LLM. Você pode configurar suas chaves de API e escolher o modelo de sua preferência."
                type="info"
                showIcon
                className="settings-alert"
              />
              
              <Form
                form={form}
                layout="vertical"
                className="settings-form"
                onFinish={handleSave}
                initialValues={{
                  llm_provider: 'dashscope',
                  model_name: 'qwen-plus',
                  chunk_size: 5000,
                  min_score_threshold: 0.7,
                  max_clips_per_collection: 5
                }}
              >
                {/* 当前提供商状态 */}
                {currentProvider.available && (
                  <Alert
                    message={`Provedor em uso: ${currentProvider.display_name} - ${currentProvider.model}`}
                    type="success"
                    showIcon
                    style={{ marginBottom: 24 }}
                  />
                )}

                {/* 提供商选择 */}
                <Form.Item
                  label="Selecionar Provedor de IA"
                  name="llm_provider"
                  className="form-item"
                  rules={[{ required: true, message: 'Selecione o provedor de IA' }]}
                >
                  <Select
                    value={selectedProvider}
                    onChange={handleProviderChange}
                    className="settings-input"
                    placeholder="Selecione o provedor de IA"
                  >
                    {Object.entries(providerConfig).map(([key, config]) => (
                      <Select.Option key={key} value={key}>
                        <Space>
                          <span style={{ color: config.color }}>{config.icon}</span>
                          <span>{config.name}</span>
                          <Tag color={config.color}>{config.description}</Tag>
                        </Space>
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>

                {/* 动态API密钥输入 */}
                <Form.Item
                  label={`Chave de API (${providerConfig[selectedProvider as keyof typeof providerConfig].name})`}
                  name={providerConfig[selectedProvider as keyof typeof providerConfig].apiKeyField}
                  className="form-item"
                  rules={[
                    { required: true, message: 'Insira a chave de API' },
                    { min: 10, message: 'A chave de API deve ter no mínimo 10 caracteres' }
                  ]}
                >
                  <Input.Password
                    placeholder={providerConfig[selectedProvider as keyof typeof providerConfig].placeholder}
                    prefix={<KeyOutlined />}
                    className="settings-input"
                  />
                </Form.Item>

                {/* Custom Provider Fields */}
                {selectedProvider === 'custom' && (
                  <>
                    <Form.Item
                      label="Base URL"
                      name="custom_base_url"
                      className="form-item"
                      rules={[{ required: true, message: 'Insira a URL base da API' }]}
                      extra="Ex: https://api.openai.com/v1"
                    >
                      <Input
                        placeholder="https://api.openai.com/v1"
                        prefix={<ApiOutlined />}
                        className="settings-input"
                      />
                    </Form.Item>

                    <Form.Item
                      label="API Style"
                      name="custom_api_style"
                      className="form-item"
                      initialValue="openai"
                    >
                      <Select className="settings-input">
                        <Select.Option value="openai">OpenAI</Select.Option>
                        <Select.Option value="anthropic">Anthropic</Select.Option>
                      </Select>
                    </Form.Item>
                  </>
                )}

                {/* 模型选择 */}
                <Form.Item
                  label="Selecionar Modelo"
                  name="model_name"
                  className="form-item"
                  rules={[{ required: true, message: 'Selecione ou digite o nome do modelo' }]}
                  extra="Permite digitar o nome do modelo ou selecionar da lista de modelos comuns"
                >
                  <Select
                    className="settings-input"
                    placeholder="Digite ou selecione o nome do modelo"
                    showSearch
                    allowClear
                    mode="tags"
                    dropdownRender={(menu) => (
                      <div>
                        {menu}
                        <Divider style={{ margin: '8px 0' }} />
                        <div style={{ padding: '0 8px 4px' }}>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            Modelos sugeridos por provedor
                          </Text>
                        </div>
                      </div>
                    )}
                  >
                    {/* 通义千问模型 */}
                    <Select.OptGroup label="Qwen (DashScope)">
                      <Select.Option value="qwen-plus">qwen-plus (Qwen Plus)</Select.Option>
                      <Select.Option value="qwen-turbo">qwen-turbo (Qwen Turbo)</Select.Option>
                      <Select.Option value="qwen-max">qwen-max (Qwen Max)</Select.Option>
                      <Select.Option value="qwen-long">qwen-long (Qwen Long Context)</Select.Option>
                    </Select.OptGroup>
                    
                    {/* OpenAI模型 */}
                    <Select.OptGroup label="OpenAI">
                      <Select.Option value="gpt-4o">gpt-4o (GPT-4 Omni)</Select.Option>
                      <Select.Option value="gpt-4o-mini">gpt-4o-mini (GPT-4 Omni Mini)</Select.Option>
                      <Select.Option value="gpt-4-turbo">gpt-4-turbo (GPT-4 Turbo)</Select.Option>
                      <Select.Option value="gpt-4">gpt-4 (GPT-4)</Select.Option>
                      <Select.Option value="gpt-3.5-turbo">gpt-3.5-turbo (GPT-3.5 Turbo)</Select.Option>
                    </Select.OptGroup>
                    
                    {/* Google Gemini模型 */}
                    <Select.OptGroup label="Google Gemini">
                      <Select.Option value="gemini-1.5-pro">gemini-1.5-pro (Gemini 1.5 Pro)</Select.Option>
                      <Select.Option value="gemini-1.5-flash">gemini-1.5-flash (Gemini 1.5 Flash)</Select.Option>
                      <Select.Option value="gemini-pro">gemini-pro (Gemini Pro)</Select.Option>
                    </Select.OptGroup>
                    
                    {/* 硅基流动模型 */}
                    <Select.OptGroup label="SiliconFlow">
                      <Select.Option value="deepseek-chat">deepseek-chat (DeepSeek Chat)</Select.Option>
                      <Select.Option value="deepseek-coder">deepseek-coder (DeepSeek Coder)</Select.Option>
                      <Select.Option value="qwen-plus">qwen-plus (Qwen Plus)</Select.Option>
                      <Select.Option value="qwen-turbo">qwen-turbo (Qwen Turbo)</Select.Option>
                    </Select.OptGroup>
                    
                  </Select>
                </Form.Item>

                <Form.Item className="form-item">
                  <Space>
                    <Button
                      type="default"
                      icon={<ApiOutlined />}
                      className="test-button"
                      onClick={handleTestApiKey}
                      loading={loading}
                    >
                      Testar Conexão
                    </Button>
                  </Space>
                </Form.Item>

                <Divider className="settings-divider" />

                <Title level={4} className="section-title">Parâmetros de Processamento</Title>
                
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      label="Tamanho do Bloco de Texto"
                      name="chunk_size"
                      className="form-item"
                    >
                      <Input 
                        type="number" 
                        placeholder="5000" 
                        addonAfter="caracteres" 
                        className="settings-input"
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      label="Pontuação Mínima de Corte"
                      name="min_score_threshold"
                      className="form-item"
                    >
                      <Input 
                        type="number" 
                        step="0.1" 
                        min="0" 
                        max="1" 
                        placeholder="0.7" 
                        className="settings-input"
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      label="Máximo de Cortes por Coleção"
                      name="max_clips_per_collection"
                      className="form-item"
                    >
                      <Input 
                        type="number" 
                        placeholder="5" 
                        addonAfter="cortes" 
                        className="settings-input"
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item className="form-item">
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SaveOutlined />}
                    size="large"
                    className="save-button"
                    loading={loading}
                  >
                    Salvar Configurações
                  </Button>
                </Form.Item>
              </Form>
            </Card>

            <Card title="Instruções de Uso" className="settings-card">
              <Space direction="vertical" size="large" className="instructions-space">
                <div className="instruction-item">
                  <Title level={5} className="instruction-title">
                    <InfoCircleOutlined /> 1. Escolha o provedor de IA
                  </Title>
                  <Paragraph className="instruction-text">
                    O sistema suporta múltiplos provedores:
                    <br />• <Text strong>OpenAI</Text>: Acesse platform.openai.com para obter sua chave
                    <br />• <Text strong>Google Gemini</Text>: Acesse ai.google.dev para obter sua chave
                    <br />• <Text strong>Qwen (DashScope)</Text>: Acesse o console da Alibaba Cloud para obter sua chave
                    <br />• <Text strong>SiliconFlow</Text>: Acesse docs.siliconflow.cn para obter sua chave
                  </Paragraph>
                </div>
                
                <div className="instruction-item">
                  <Title level={5} className="instruction-title">
                    <InfoCircleOutlined /> 2. Descrição dos parâmetros
                  </Title>
                  <Paragraph className="instruction-text">
                    • <Text strong>Tamanho do Bloco</Text>: Impacta a velocidade e precisão da análise (recomendado: 5000 caracteres)<br />
                    • <Text strong>Pontuação Mínima</Text>: Apenas trechos com pontuação igual ou superior a este valor são mantidos<br />
                    • <Text strong>Cortes por Coleção</Text>: Define a quantidade máxima de cortes agrupados por tema
                  </Paragraph>
                </div>
                
                <div className="instruction-item">
                  <Title level={5} className="instruction-title">
                    <InfoCircleOutlined /> 3. Teste a conexão
                  </Title>
                  <Paragraph className="instruction-text">
                    Recomenda-se clicar em "Testar Conexão" para validar a chave de API antes de processar vídeos
                  </Paragraph>
                </div>
              </Space>
            </Card>
          </TabPane>

          <TabPane 
            tab={
              <span>
                <SoundOutlined />
                Reconhecimento de Voz
              </span>
            } 
            key="speech"
          >
            <Card title="Configuração de Reconhecimento de Voz" className="settings-card">
              <Alert
                message="Serviço de Reconhecimento de Fala (Whisper)"
                description="Configure o serviço de transcrição para gerar legendas automáticas em vídeos que não possuam legendas nativas."
                type="info"
                showIcon
                className="settings-alert"
              />
              
              <SpeechRecognitionConfig
                onConfigChange={(config) => {
                  console.log('Configuração de voz atualizada:', config)
                }}
              />
            </Card>
          </TabPane>

          <TabPane 
            tab={
              <span>
                <SettingOutlined />
                Aplicativo
              </span>
            } 
            key="app"
          >
            <Card title="Configurações do Aplicativo" className="settings-card">
              <Alert
                message="Comportamento do Aplicativo"
                description="Configure as opções de inicialização e integração com o sistema operacional."
                type="info"
                showIcon
                className="settings-alert"
              />
              
              <AppSettings />
            </Card>

            <Card title="Privacidade e Dados" className="settings-card" style={{ marginTop: 16 }}>
              <Alert
                message="Estatísticas de Uso"
                description="Para melhorar continuamente o produto, dados anônimos de uso podem ser coletados. Nenhum conteúdo de vídeo, texto de legenda ou chave de API é transmitido. Você pode desativar a qualquer momento."
                type="info"
                showIcon
                className="settings-alert"
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
                <div>
                  <Text strong>Permitir estatísticas anônimas de uso</Text>
                  <Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
                    Ao desativar, nenhum dado de telemetria será enviado.
                  </Paragraph>
                </div>
                <Switch
                  checked={analyticsOn}
                  onChange={(checked) => {
                    setAnalyticsEnabled(checked)
                    setAnalyticsOn(checked)
                    message.success(checked ? 'Estatísticas anônimas ativadas' : 'Estatísticas anônimas desativadas')
                  }}
                />
              </div>
            </Card>
          </TabPane>

          <TabPane tab="Contas e Publicação" key="bilibili">
            <Card title="Gerenciamento de Contas" className="settings-card">
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ marginBottom: '24px' }}>
                  <UserOutlined style={{ fontSize: '48px', color: '#1890ff', marginBottom: '16px' }} />
                  <Title level={3} style={{ color: 'var(--ac-ink)', margin: '0 0 8px 0' }}>
                    Publicação em Redes de Vídeo
                  </Title>
                  <Text type="secondary" style={{ color: '#b0b0b0', fontSize: '16px' }}>
                    Gerencie contas para publicação direta e automatizada de cortes
                  </Text>
                </div>
                
                <Space size="large">
                  <Button
                    type="primary"
                    size="large"
                    icon={<UserOutlined />}
                    onClick={() => message.info('Em breve disponível', 3)}
                    style={{
                      borderRadius: '8px',
                      background: 'linear-gradient(45deg, #1890ff, #36cfc9)',
                      border: 'none',
                      fontWeight: 500,
                      height: '48px',
                      padding: '0 32px',
                      fontSize: '16px'
                    }}
                  >
                    Gerenciar Contas
                  </Button>
                </Space>
                
                <div style={{ marginTop: '32px', textAlign: 'left', maxWidth: '600px', margin: '32px auto 0' }}>
                  <Title level={4} style={{ color: 'var(--ac-ink)', marginBottom: '16px' }}>
                    Recursos
                  </Title>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                    <div style={{ 
                      padding: '16px', 
                      background: 'rgba(255,255,255,0.05)', 
                      borderRadius: '8px', 
                      border: '1px solid #404040'
                    }}>
                      <Text strong style={{ color: '#1890ff' }}>Multi-contas</Text>
                      <br />
                      <Text type="secondary" style={{ color: '#b0b0b0' }}>
                        Adicione e alterne facilmente entre múltiplos perfis
                      </Text>
                    </div>
                    <div style={{ 
                      padding: '16px', 
                      background: 'rgba(255,255,255,0.05)', 
                      borderRadius: '8px', 
                      border: '1px solid #404040'
                    }}>
                      <Text strong style={{ color: '#52c41a' }}>Login Seguro</Text>
                      <br />
                      <Text type="secondary" style={{ color: '#b0b0b0' }}>
                        Importação segura de sessões para postagens automáticas
                      </Text>
                    </div>
                    <div style={{ 
                      padding: '16px', 
                      background: 'rgba(255,255,255,0.05)', 
                      borderRadius: '8px', 
                      border: '1px solid #404040'
                    }}>
                      <Text strong style={{ color: '#faad14' }}>Postagem Rápida</Text>
                      <br />
                      <Text type="secondary" style={{ color: '#b0b0b0' }}>
                        Publique cortes diretamente da tela de detalhes
                      </Text>
                    </div>
                    <div style={{ 
                      padding: '16px', 
                      background: 'rgba(255,255,255,0.05)', 
                      borderRadius: '8px', 
                      border: '1px solid #404040'
                    }}>
                      <Text strong style={{ color: '#722ed1' }}>Gestão em Massa</Text>
                      <br />
                      <Text type="secondary" style={{ color: '#b0b0b0' }}>
                        Envie múltiplos cortes em lote com agilidade
                      </Text>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </TabPane>
        </Tabs>

        {/* B站管理弹窗 */}
        <BilibiliManager
          visible={showBilibiliManager}
          onClose={() => setShowBilibiliManager(false)}
          onUploadSuccess={() => {
            message.success('Operação concluída com sucesso')
          }}
        />
      </div>
    </Content>
  )
}

// 应用设置组件
const AppSettings: React.FC = () => {
  const [autostartEnabled, setAutostartEnabled] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    checkAutostartStatus()
  }, [])

  const checkAutostartStatus = async () => {
    try {
      const isDesktop = await isDesktopMode()
      if (isDesktop) {
        const { invoke } = await import('@tauri-apps/api/core')
        const enabled = await invoke('is_autostart_enabled')
        setAutostartEnabled(Boolean(enabled))
      }
    } catch (error) {
      console.error('Falha ao verificar status de inicialização automática:', error)
    }
  }

  const handleAutostartToggle = async (enabled: boolean) => {
    const isDesktop = await isDesktopMode()
    if (!isDesktop) {
      message.error('Esta funcionalidade está disponível apenas no aplicativo Desktop')
      return
    }

    setLoading(true)
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      
      if (enabled) {
        await invoke('enable_autostart')
        message.success('Inicialização automática ativada')
      } else {
        await invoke('disable_autostart')
        message.success('Inicialização automática desativada')
      }
      
      setAutostartEnabled(enabled)
    } catch (error) {
      console.error('Falha ao alternar inicialização automática:', error)
      message.error(`Falha na operação: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card 
            size="small" 
            style={{ 
              background: 'rgba(255,255,255,0.05)', 
              border: '1px solid #404040',
              marginBottom: '16px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                  <PoweroffOutlined style={{ color: '#1890ff', marginRight: '8px' }} />
                  <Text strong style={{ color: 'var(--ac-ink)' }}>Iniciar com o sistema</Text>
                </div>
                <Text type="secondary" style={{ color: '#b0b0b0' }}>
                  Quando ativado, o aplicativo iniciará automaticamente junto com o sistema operacional
                </Text>
              </div>
              <Switch
                checked={autostartEnabled}
                onChange={handleAutostartToggle}
                loading={loading}
                checkedChildren="Sim"
                unCheckedChildren="Não"
              />
            </div>
          </Card>
        </Col>
      </Row>
      
      <Alert
        message="Informação"
        description="A inicialização automática está disponível na versão desktop. O aplicativo será executado em segundo plano e poderá ser acessado pela bandeja do sistema."
        type="info"
        showIcon
        style={{ marginTop: '16px' }}
      />
    </div>
  )
}

export default SettingsPage
