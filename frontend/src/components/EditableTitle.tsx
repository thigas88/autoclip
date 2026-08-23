import React, { useState, useRef, useEffect } from 'react'
import { Input, Button, Space, message, Tooltip, Modal } from 'antd'
import { EditOutlined, CheckOutlined } from '@ant-design/icons'
import { projectApi } from '../services/api'
import MagicWandIcon from './icons/MagicWandIcon'

interface EditableTitleProps {
  title: string
  clipId: string
  onTitleUpdate?: (newTitle: string) => void
  maxLength?: number
  style?: React.CSSProperties
  className?: string
}

const EditableTitle: React.FC<EditableTitleProps> = ({
  title,
  clipId,
  onTitleUpdate,
  maxLength = 200,
  style,
  className
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(title)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const inputRef = useRef<any>(null)

  // 当外部title变化时，同步内部状态
  useEffect(() => {
    setEditValue(title)
  }, [title])

  // 当title变化时，如果不在编辑模式，确保显示最新值
  useEffect(() => {
    if (!isEditing) {
      setEditValue(title)
    }
  }, [title, isEditing])

  // 进入编辑模式时聚焦输入框
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      // TextArea组件没有select方法，使用setSelectionRange代替
      if (inputRef.current.setSelectionRange) {
        inputRef.current.setSelectionRange(0, inputRef.current.value.length)
      }
    }
  }, [isEditing])

  const handleStartEdit = () => {
    setEditValue(title)
    setIsEditing(true)
  }

  const handleCancel = () => {
    setEditValue(title)
    setIsEditing(false)
  }

  const handleSave = async () => {
    const trimmedValue = editValue.trim()
    
    if (!trimmedValue) {
      message.error('O título não pode ficar vazio')
      return
    }
    
    if (trimmedValue.length > maxLength) {
      message.error(`O título não pode ter mais de ${maxLength} caracteres`)
      return
    }
    
    if (trimmedValue === title) {
      setIsEditing(false)
      return
    }

    setLoading(true)
    try {
      await projectApi.updateClipTitle(clipId, trimmedValue)
      message.success('Título atualizado com sucesso')
      setIsEditing(false)
      // 先更新本地状态，再调用回调
      onTitleUpdate?.(trimmedValue)
    } catch (error: any) {
      console.error('更新标题失败:', error)
      message.error(error.userMessage || error.message || 'Falha ao atualizar título')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateTitle = async () => {
    console.log('开始生成标题，clipId:', clipId)
    setGenerating(true)
    try {
      const result = await projectApi.generateClipTitle(clipId)
      console.log('生成标题结果:', result)
      if (result.success && result.generated_title) {
        setEditValue(result.generated_title)
        message.success('Título gerado com sucesso! Você pode editá-lo ou salvar.')
      } else {
        message.error('Falha ao gerar título')
      }
    } catch (error: any) {
      console.error('生成标题失败:', error)
      message.error(error.userMessage || error.message || 'Falha ao gerar título')
    } finally {
      setGenerating(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  if (isEditing) {
    return (
      <Modal
        title="Editar Título"
        open={isEditing}
        onCancel={handleCancel}
        footer={null}
        width={600}
        destroyOnClose
        maskClosable={false}
      >
        <div style={{ marginBottom: '16px' }}>
          <Input.TextArea
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyPress}
            maxLength={maxLength}
            placeholder="Digite o título"
            autoSize={{ minRows: 3, maxRows: 8 }}
            style={{ 
              resize: 'none',
              fontSize: '14px',
              lineHeight: '1.5'
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '12px', color: '#666' }}>
            Caracteres: {editValue.length}/{maxLength}
          </div>
          <Space>
            <Tooltip title="Gerar título com IA">
              <Button
                icon={<MagicWandIcon />}
                loading={generating}
                onClick={() => {
                  console.log('AI生成标题按钮被点击');
                  handleGenerateTitle();
                }}
                disabled={loading}
              >
                Gerar com IA
              </Button>
            </Tooltip>
            <Button onClick={handleCancel} disabled={loading || generating}>
              Cancelar
            </Button>
            <Button
              type="primary"
              icon={<CheckOutlined />}
              loading={loading}
              onClick={handleSave}
              disabled={generating}
            >
              Salvar
            </Button>
          </Space>
        </div>
      </Modal>
    )
  }

  return (
    <div
      style={{
        cursor: 'pointer',
        padding: '4px 0',
        ...style
      }}
      className={className}
      onClick={handleStartEdit}
      title="Clique para editar o título"
    >
      <span style={{ 
        wordBreak: 'break-word',
        lineHeight: '1.5',
        fontSize: '14px',
        minHeight: '20px',
        display: 'inline'
      }}>
        {title}
        <EditOutlined 
          style={{ 
            color: '#1890ff', 
            fontSize: '12px',
            opacity: 0.7,
            transition: 'opacity 0.2s',
            marginLeft: '6px',
            display: 'inline'
          }}
        />
      </span>
    </div>
  )
}

export default EditableTitle
