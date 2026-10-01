/**
 * React Error Boundary component
 * Captures JavaScript errors in child components, logs error info, and displays fallback UI
 */

import { Component, ErrorInfo, ReactNode } from 'react'
import { Result, Button, Card, Typography, Space, Collapse } from 'antd'
import { ReloadOutlined, BugOutlined, HomeOutlined } from '@ant-design/icons'
import { errorHandler } from '../utils/errorHandler'

const { Title, Text, Paragraph } = Typography
const { Panel } = Collapse

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  showDetails?: boolean
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo })

    errorHandler.handleError(error, 'ReactErrorBoundary')

    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    console.group('🚨 React Error Boundary')
    console.error('Error:', error)
    console.error('Error Info:', errorInfo)
    console.error('Error ID:', this.state.errorId)
    console.groupEnd()
  }

  handleReload = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    })

    window.location.reload()
  }

  handleGoHome = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    })

    window.location.href = '/'
  }

  handleReportError = () => {
    const { error, errorInfo, errorId } = this.state

    if (!error) return

    const errorReport = {
      id: errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: localStorage.getItem('userId') || 'anonymous'
    }

    console.log('Error Report:', errorReport)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      const { error, errorInfo, errorId } = this.state

      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          background: '#f8f9fa'
        }}>
          <Card
            style={{
              maxWidth: '600px',
              width: '100%',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              borderRadius: '12px',
              border: '1px solid #e8e8e8'
            }}
          >
            <Result
              status="error"
              title="Erro na página"
              subTitle="Desculpe, ocorreu um erro inesperado. O problema foi registrado. Tente as soluções abaixo:"
              extra={
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <Space>
                    <Button
                      type="primary"
                      icon={<ReloadOutlined />}
                      onClick={this.handleReload}
                    >
                      Atualizar página
                    </Button>
                    <Button
                      icon={<HomeOutlined />}
                      onClick={this.handleGoHome}
                    >
                      Voltar ao início
                    </Button>
                  </Space>

                  <Button
                    type="link"
                    icon={<BugOutlined />}
                    onClick={this.handleReportError}
                  >
                    Reportar este erro
                  </Button>
                </Space>
              }
            />

            {this.props.showDetails && error && (
              <div style={{ marginTop: '24px' }}>
                <Title level={5}>Detalhes do erro</Title>
                <Paragraph>
                  <Text code>ID do erro: {errorId}</Text>
                </Paragraph>

                <Collapse size="small">
                  <Panel header="Mensagem de erro" key="1">
                    <pre style={{
                      background: '#f5f5f5',
                      padding: '12px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      overflow: 'auto',
                      maxHeight: '200px'
                    }}>
                      {error.message}
                    </pre>
                  </Panel>

                  {error.stack && (
                    <Panel header="Stack trace" key="2">
                      <pre style={{
                        background: '#f5f5f5',
                        padding: '12px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        overflow: 'auto',
                        maxHeight: '300px'
                      }}>
                        {error.stack}
                      </pre>
                    </Panel>
                  )}

                  {errorInfo?.componentStack && (
                    <Panel header="Stack de componentes" key="3">
                      <pre style={{
                        background: '#f5f5f5',
                        padding: '12px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        overflow: 'auto',
                        maxHeight: '300px'
                      }}>
                        {errorInfo.componentStack}
                      </pre>
                    </Panel>
                  )}
                </Collapse>
              </div>
            )}

            <div style={{ marginTop: '24px' }}>
              <Title level={5}>Soluções comuns</Title>
              <ul style={{ paddingLeft: '20px', color: '#666' }}>
                <li>Atualize a página e tente novamente</li>
                <li>Limpe o cache e os cookies do navegador</li>
                <li>Verifique sua conexão com a internet</li>
                <li>Tente usar outro navegador</li>
                <li>Se o problema persistir, entre em contato com o suporte</li>
              </ul>
            </div>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary