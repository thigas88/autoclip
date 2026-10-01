import React, { useState } from 'react'
import { Modal, Steps, Card, Typography, Alert, Button, Space, Divider } from 'antd'
import { QuestionCircleOutlined, CopyOutlined, CheckOutlined } from '@ant-design/icons'

const { Paragraph, Text } = Typography
const { Step } = Steps

interface CookieHelperProps {
  visible: boolean
  onClose: () => void
}

const CookieHelper: React.FC<CookieHelperProps> = ({ visible, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0)
  const [copied, setCopied] = useState(false)

  const steps = [
    {
      title: 'Entrar no Bilibili',
      description: 'Faça login na sua conta do Bilibili no navegador',
      content: (
        <div>
          <Alert
            message="Passo 1: Entrar no Bilibili"
            description="Certifique-se de que você já está logado na sua conta do Bilibili no navegador"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Card size="small">
            <Paragraph>
              1. Abra o navegador e acesse <Text code>https://www.bilibili.com</Text>
            </Paragraph>
            <Paragraph>
              2. Clique no botão "Login" no canto superior direito
            </Paragraph>
            <Paragraph>
              3. Faça login com sua conta do Bilibili
            </Paragraph>
            <Paragraph>
              4. Após confirmar o login, seu nome de usuário deve aparecer no canto superior direito
            </Paragraph>
          </Card>
        </div>
      )
    },
    {
      title: 'Abrir ferramentas de desenvolvedor',
      description: 'Pressione F12 para abrir as ferramentas de desenvolvedor do navegador',
      content: (
        <div>
          <Alert
            message="Passo 2: Abrir ferramentas de desenvolvedor"
            description="Use o atalho de teclado para abrir as ferramentas de desenvolvedor do navegador"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Card size="small">
            <Paragraph>
              <Text strong>Windows/Linux:</Text> Pressione a tecla <Text code>F12</Text>
            </Paragraph>
            <Paragraph>
              <Text strong>Mac:</Text> Pressione <Text code>Command + Option + I</Text>
            </Paragraph>
            <Paragraph>
              Ou clique com o botão direito em uma área vazia da página e selecione "Inspecionar" ou "Inspect"
            </Paragraph>
            <Divider />
            <Paragraph type="secondary">
              As ferramentas de desenvolvedor serão abertas na parte inferior ou lateral da página, com várias abas
            </Paragraph>
          </Card>
        </div>
      )
    },
    {
      title: 'Ir para a aba Network',
      description: 'Encontre a aba Network (Rede)',
      content: (
        <div>
          <Alert
            message="Passo 3: Ir para a aba Network"
            description="Encontre a aba Network nas ferramentas de desenvolvedor"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Card size="small">
            <Paragraph>
              1. Encontre as abas na parte superior das ferramentas de desenvolvedor
            </Paragraph>
            <Paragraph>
              2. Clique na aba <Text code>Network</Text>
            </Paragraph>
            <Paragraph>
              3. Certifique-se de que o painel Network esteja vazio (se houver conteúdo, clique no botão de limpar)
            </Paragraph>
            <Divider />
            <Paragraph type="secondary">
              A aba Network é usada para monitorar as requisições de rede da página, incluindo informações de Cookie
            </Paragraph>
          </Card>
        </div>
      )
    },
    {
      title: 'Atualizar a página',
      description: 'Atualize a página do Bilibili para capturar as requisições',
      content: (
        <div>
          <Alert
            message="Passo 4: Atualizar a página"
            description="Atualize a página do Bilibili para capturar as requisições de rede"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Card size="small">
            <Paragraph>
              1. Certifique-se de que a aba Network esteja aberta
            </Paragraph>
            <Paragraph>
              2. Pressione <Text code>F5</Text> ou clique no botão de atualizar do navegador
            </Paragraph>
            <Paragraph>
              3. Observe a lista de requisições que aparece no painel Network
            </Paragraph>
            <Divider />
            <Paragraph type="secondary">
              Após atualizar, o painel Network exibirá todas as requisições de rede feitas durante o carregamento da página
            </Paragraph>
          </Card>
        </div>
      )
    },
    {
      title: 'Encontrar o Cookie',
      description: 'Encontre as informações de Cookie nos cabeçalhos da requisição',
      content: (
        <div>
          <Alert
            message="Passo 5: Encontrar as informações de Cookie"
            description="Encontre o campo Cookie em qualquer requisição"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Card size="small">
            <Paragraph>
              1. No painel Network, encontre qualquer requisição (geralmente escolha a primeira)
            </Paragraph>
            <Paragraph>
              2. Clique na requisição e encontre a aba <Text code>Headers</Text> no painel à direita
            </Paragraph>
            <Paragraph>
              3. Na seção <Text code>Request Headers</Text>, encontre o campo <Text code>Cookie</Text>
            </Paragraph>
            <Paragraph>
              4. O valor do campo Cookie é a string completa de Cookie que você precisa
            </Paragraph>
            <Divider />
            <Paragraph type="secondary">
              A string de Cookie geralmente é longa, contendo vários pares chave-valor separados por ponto e vírgula
            </Paragraph>
          </Card>
        </div>
      )
    },
    {
      title: 'Copiar o Cookie',
      description: 'Copie a string completa de Cookie',
      content: (
        <div>
          <Alert
            message="Passo 6: Copiar o Cookie"
            description="Copie a string completa de Cookie para a área de transferência"
            type="success"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Card size="small">
            <Paragraph>
              1. Clique com o botão direito no valor do campo Cookie
            </Paragraph>
            <Paragraph>
              2. Selecione "Copiar valor" ou "Copy value"
            </Paragraph>
            <Paragraph>
              3. Ou dê duplo clique para selecionar todo o valor do Cookie e pressione <Text code>Ctrl+C</Text> para copiar
            </Paragraph>
            <Divider />
            <Paragraph type="secondary">
              A string de Cookie copiada pode ser colada diretamente no campo de Cookie do AutoClip
            </Paragraph>
            <Alert
              message="Aviso importante"
              description="O Cookie contém suas informações de login. Mantenha-o seguro e não compartilhe com outras pessoas"
              type="warning"
              showIcon
            />
          </Card>
        </div>
      )
    }
  ]

  const handleCopy = () => {
    const cookieExample = "SESSDATA=your_sessdata_here; bili_jct=your_bili_jct_here; DedeUserID=your_dedeuserid_here"
    navigator.clipboard.writeText(cookieExample).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <Modal
      title={
        <Space>
          <QuestionCircleOutlined />
          <span>Guia para obter o Cookie</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="back" onClick={onClose}>
          Fechar
        </Button>,
        <Button
          key="copy"
          icon={copied ? <CheckOutlined /> : <CopyOutlined />}
          onClick={handleCopy}
        >
          {copied ? 'Copiado' : 'Copiar exemplo'}
        </Button>
      ]}
      width={700}
    >
      <div style={{ marginBottom: 16 }}>
        <Alert
          message="Importar Cookie é a forma mais segura de fazer login"
          description="Comparado ao login por QR Code, importar Cookie não aciona os mecanismos de proteção do Bilibili e é a forma mais recomendada de login."
          type="success"
          showIcon
        />
      </div>

      <Steps current={currentStep} onChange={setCurrentStep} direction="vertical" size="small">
        {steps.map((step, index) => (
          <Step key={index} title={step.title} description={step.description} />
        ))}
      </Steps>

      <div style={{ marginTop: 24, padding: 16, backgroundColor: '#f5f5f5', borderRadius: 8 }}>
        {steps[currentStep].content}
      </div>

      <Divider />

      <Card size="small" title="Exemplo de formato de Cookie">
        <Paragraph code style={{ fontSize: '12px', wordBreak: 'break-all' }}>
          SESSDATA=your_sessdata_here; bili_jct=your_bili_jct_here; DedeUserID=your_dedeuserid_here; buvid3=your_buvid3_here
        </Paragraph>
        <Paragraph type="secondary" style={{ fontSize: '12px' }}>
          Nota: o valor real do Cookie será muito mais longo que este exemplo, contendo mais campos
        </Paragraph>
      </Card>
    </Modal>
  )
}

export default CookieHelper