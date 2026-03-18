/* eslint-disable */
// ============================================
// Testes — FieldRenderer (Fase 4)
// ============================================
// Cobre todos os 12 tipos de campo renderizados
// pelo FieldRenderer: text, number, photo, dropdown,
// signature, datetime, checkbox_multiple, gps,
// barcode, calculated, yes_no, rating.
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FieldRenderer } from '../FieldRenderer'
import type { TemplateField } from '@/types/database'

// --- Helpers ---

function createTemplateField(overrides: Partial<TemplateField> = {}): TemplateField {
  return {
    id: 1,
    template_id: 1,
    section_id: null,
    name: 'Campo Teste',
    field_type: 'text',
    is_required: false,
    sort_order: 0,
    options: null,
    validation: null,
    calculation: null,
    placeholder: null,
    help_text: null,
    ...overrides,
  } as TemplateField
}

// Mock global fetch for YesNoField API calls
beforeEach(() => {
  vi.restoreAllMocks()
  // Clear module-level caches between tests
  // The caches are module-scoped, so we mock fetch to avoid real requests
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ users: [], presets: [] }),
  }) as unknown as typeof fetch
})

// ============================================
// FieldRenderer — Wrapper
// ============================================

describe('FieldRenderer', () => {
  it('renderiza label com nome do campo', () => {
    render(<FieldRenderer field={createTemplateField({ name: 'Piso limpo?' })} value="" onChange={vi.fn()} />)
    expect(screen.getByText('Piso limpo?')).toBeInTheDocument()
  })

  it('mostra indicador de obrigatorio quando is_required=true', () => {
    render(<FieldRenderer field={createTemplateField({ is_required: true })} value="" onChange={vi.fn()} />)
    expect(screen.getByText('*')).toBeInTheDocument()
  })

  it('nao mostra indicador de obrigatorio quando is_required=false', () => {
    render(<FieldRenderer field={createTemplateField({ is_required: false })} value="" onChange={vi.fn()} />)
    expect(screen.queryByText('*')).not.toBeInTheDocument()
  })

  it('mostra help_text quando configurado', () => {
    render(
      <FieldRenderer
        field={createTemplateField({ help_text: 'Verifique o chao' })}
        value=""
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText('Verifique o chao')).toBeInTheDocument()
  })

  it('mostra mensagem de erro quando error prop fornecida', () => {
    render(
      <FieldRenderer
        field={createTemplateField()}
        value=""
        onChange={vi.fn()}
        error="Campo obrigatorio"
      />
    )
    expect(screen.getByText('Campo obrigatorio')).toBeInTheDocument()
  })

  it('mostra mensagem para tipo de campo nao suportado', () => {
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'unknown_type' as TemplateField['field_type'] })}
        value=""
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText(/Campo não suportado/)).toBeInTheDocument()
  })
})

// ============================================
// TextField
// ============================================

describe('TextField', () => {
  it('renderiza input text com valor', () => {
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'text' })}
        value="Hello"
        onChange={vi.fn()}
      />
    )
    const input = screen.getByRole('textbox')
    expect(input).toHaveValue('Hello')
  })

  it('chama onChange ao digitar', async () => {
    const onChange = vi.fn()
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'text' })}
        value=""
        onChange={onChange}
      />
    )
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Novo texto' } })
    expect(onChange).toHaveBeenCalledWith('Novo texto')
  })

  it('renderiza placeholder quando configurado', () => {
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'text', placeholder: 'Digite aqui...' })}
        value=""
        onChange={vi.fn()}
      />
    )
    expect(screen.getByPlaceholderText('Digite aqui...')).toBeInTheDocument()
  })

  it('renderiza vazio quando value=null', () => {
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'text' })}
        value={null}
        onChange={vi.fn()}
      />
    )
    const input = screen.getByRole('textbox')
    expect(input).toHaveValue('')
  })
})

// ============================================
// NumberField
// ============================================

describe('NumberField', () => {
  it('renderiza input com valor numerico', () => {
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'number', options: { numberSubtype: 'decimal' } })}
        value={10}
        onChange={vi.fn()}
      />
    )
    const input = screen.getByRole('textbox')
    expect(input).toHaveValue('10')
  })

  it('mostra prefixo R$ para subtype monetario', () => {
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'number', options: { numberSubtype: 'monetario' } })}
        value={0}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText('R$')).toBeInTheDocument()
  })

  it('mostra sufixo un para subtype quantidade', () => {
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'number', options: { numberSubtype: 'quantidade' } })}
        value={5}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText('un')).toBeInTheDocument()
  })

  it('mostra sufixo % para subtype porcentagem', () => {
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'number', options: { numberSubtype: 'porcentagem' } })}
        value={50}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText('%')).toBeInTheDocument()
  })

  it('chama onChange com objeto { subtype, number } ao digitar', () => {
    const onChange = vi.fn()
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'number', options: { numberSubtype: 'decimal' } })}
        value={0}
        onChange={onChange}
      />
    )
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '15,5' } })
    expect(onChange).toHaveBeenCalledWith({ subtype: 'decimal', number: 15.5 })
  })

  it('aceita valor object com propriedade number', () => {
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'number', options: { numberSubtype: 'decimal' } })}
        value={{ number: 25.5, subtype: 'decimal' }}
        onChange={vi.fn()}
      />
    )
    const input = screen.getByRole('textbox')
    // Number is displayed with comma as decimal separator (pt-BR)
    expect(input).toHaveValue('25,5')
  })

  it('filtra caracteres nao numericos em quantidade', () => {
    const onChange = vi.fn()
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'number', options: { numberSubtype: 'quantidade' } })}
        value={0}
        onChange={onChange}
      />
    )
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '12abc' } })
    expect(onChange).toHaveBeenCalledWith({ subtype: 'quantidade', number: 12 })
  })

  it('usa subtype decimal como default', () => {
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'number' })}
        value={0}
        onChange={vi.fn()}
      />
    )
    // No prefix or un/% suffix for decimal
    expect(screen.queryByText('R$')).not.toBeInTheDocument()
    expect(screen.queryByText('%')).not.toBeInTheDocument()
    expect(screen.queryByText('un')).not.toBeInTheDocument()
  })
})

// ============================================
// DropdownField
// ============================================

describe('DropdownField', () => {
  it('renderiza select com placeholder', () => {
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'dropdown', options: ['Bom', 'Regular', 'Ruim'] })}
        value=""
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText('Selecione...')).toBeInTheDocument()
  })

  it('mostra valor selecionado', () => {
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'dropdown', options: ['Bom', 'Regular', 'Ruim'] })}
        value="Bom"
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText('Bom')).toBeInTheDocument()
  })

  it('abre dropdown e mostra opcoes ao clicar', async () => {
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'dropdown', options: ['Bom', 'Regular', 'Ruim'] })}
        value=""
        onChange={vi.fn()}
      />
    )
    // Click trigger to open
    fireEvent.click(screen.getByText('Selecione...'))
    // All options should appear in the listbox
    const options = screen.getAllByRole('option')
    expect(options.length).toBeGreaterThanOrEqual(3)
  })

  it('chama onChange ao selecionar opcao', () => {
    const onChange = vi.fn()
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'dropdown', options: ['Bom', 'Regular', 'Ruim'] })}
        value=""
        onChange={onChange}
      />
    )
    fireEvent.click(screen.getByText('Selecione...'))
    // mousedown is used by Select to select
    fireEvent.mouseDown(screen.getByText('Ruim'))
    expect(onChange).toHaveBeenCalledWith('Ruim')
  })

  it('renderiza sem opcoes quando options=null', () => {
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'dropdown', options: null })}
        value=""
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText('Selecione...')).toBeInTheDocument()
  })
})

// ============================================
// DateTimeField
// ============================================

describe('DateTimeField', () => {
  it('renderiza input datetime-local', () => {
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'datetime' })}
        value="2026-03-18T14:00"
        onChange={vi.fn()}
      />
    )
    const input = document.querySelector('input[type="datetime-local"]')
    expect(input).toBeInTheDocument()
    expect(input).toHaveValue('2026-03-18T14:00')
  })

  it('chama onChange ao alterar data/hora', () => {
    const onChange = vi.fn()
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'datetime' })}
        value=""
        onChange={onChange}
      />
    )
    const input = document.querySelector('input[type="datetime-local"]')!
    fireEvent.change(input, { target: { value: '2026-03-20T10:30' } })
    expect(onChange).toHaveBeenCalledWith('2026-03-20T10:30')
  })
})

// ============================================
// CheckboxMultipleField
// ============================================

describe('CheckboxMultipleField', () => {
  const checkboxField = createTemplateField({
    field_type: 'checkbox_multiple',
    options: ['Limpeza', 'Organizacao', 'Seguranca'],
  })

  it('renderiza todos os checkboxes', () => {
    render(<FieldRenderer field={checkboxField} value={[]} onChange={vi.fn()} />)
    expect(screen.getByText('Limpeza')).toBeInTheDocument()
    expect(screen.getByText('Organizacao')).toBeInTheDocument()
    expect(screen.getByText('Seguranca')).toBeInTheDocument()
  })

  it('marca checkbox que esta no value', () => {
    render(<FieldRenderer field={checkboxField} value={['Limpeza']} onChange={vi.fn()} />)
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes[0]).toBeChecked()
    expect(checkboxes[1]).not.toBeChecked()
    expect(checkboxes[2]).not.toBeChecked()
  })

  it('adiciona item ao clicar em checkbox nao marcado', () => {
    const onChange = vi.fn()
    render(<FieldRenderer field={checkboxField} value={['Limpeza']} onChange={onChange} />)
    fireEvent.click(screen.getAllByRole('checkbox')[1]) // Organizacao
    expect(onChange).toHaveBeenCalledWith(['Limpeza', 'Organizacao'])
  })

  it('remove item ao clicar em checkbox marcado', () => {
    const onChange = vi.fn()
    render(<FieldRenderer field={checkboxField} value={['Limpeza', 'Seguranca']} onChange={onChange} />)
    fireEvent.click(screen.getAllByRole('checkbox')[0]) // Limpeza
    expect(onChange).toHaveBeenCalledWith(['Seguranca'])
  })

  it('funciona com value null', () => {
    render(<FieldRenderer field={checkboxField} value={null} onChange={vi.fn()} />)
    const checkboxes = screen.getAllByRole('checkbox')
    checkboxes.forEach(cb => expect(cb).not.toBeChecked())
  })
})

// ============================================
// BarcodeField
// ============================================

describe('BarcodeField', () => {
  it('renderiza input text para codigo de barras', () => {
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'barcode' })}
        value=""
        onChange={vi.fn()}
      />
    )
    expect(screen.getByPlaceholderText('Digite ou escaneie o código')).toBeInTheDocument()
  })

  it('chama onChange ao digitar codigo', () => {
    const onChange = vi.fn()
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'barcode' })}
        value=""
        onChange={onChange}
      />
    )
    const input = screen.getByPlaceholderText('Digite ou escaneie o código')
    fireEvent.change(input, { target: { value: '7891234567890' } })
    expect(onChange).toHaveBeenCalledWith('7891234567890')
  })

  it('exibe placeholder customizado', () => {
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'barcode', placeholder: 'EAN-13...' })}
        value=""
        onChange={vi.fn()}
      />
    )
    expect(screen.getByPlaceholderText('EAN-13...')).toBeInTheDocument()
  })

  it('mostra aviso sobre mobile', () => {
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'barcode' })}
        value=""
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText(/app mobile/)).toBeInTheDocument()
  })
})

// ============================================
// CalculatedField
// ============================================

describe('CalculatedField', () => {
  it('mostra valor calculado formatado', () => {
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'calculated' })}
        value={42.567}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText('42.57')).toBeInTheDocument()
  })

  it('mostra indicador de campo calculado', () => {
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'calculated' })}
        value={10}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText('(calculado automaticamente)')).toBeInTheDocument()
  })

  it('mostra traço quando valor undefined', () => {
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'calculated' })}
        value={undefined}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText('-')).toBeInTheDocument()
  })

  it('mostra traço quando valor null', () => {
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'calculated' })}
        value={null}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText('-')).toBeInTheDocument()
  })
})

// ============================================
// YesNoField
// ============================================

describe('YesNoField', () => {
  it('renderiza botoes Sim e Nao', () => {
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'yes_no' })}
        value=""
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText('Sim')).toBeInTheDocument()
    expect(screen.getByText('Nao')).toBeInTheDocument()
  })

  it('chama onChange com "sim" ao clicar Sim', () => {
    const onChange = vi.fn()
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'yes_no' })}
        value=""
        onChange={onChange}
      />
    )
    fireEvent.click(screen.getByText('Sim'))
    expect(onChange).toHaveBeenCalledWith('sim')
  })

  it('chama onChange com "nao" ao clicar Nao', () => {
    const onChange = vi.fn()
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'yes_no' })}
        value=""
        onChange={onChange}
      />
    )
    fireEvent.click(screen.getByText('Nao'))
    expect(onChange).toHaveBeenCalledWith('nao')
  })

  it('aceita valor string legado', () => {
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'yes_no' })}
        value="sim"
        onChange={vi.fn()}
      />
    )
    // Sim button should have selected styling (emerald border)
    const simButton = screen.getByText('Sim').closest('button')!
    expect(simButton.className).toContain('emerald')
  })

  it('aceita valor object com answer', () => {
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'yes_no' })}
        value={{ answer: 'nao' }}
        onChange={vi.fn()}
      />
    )
    const naoButton = screen.getByText('Nao').closest('button')!
    expect(naoButton.className).toContain('red')
  })

  it('mostra campos condicionais ao responder Nao quando onNo configurado', () => {
    render(
      <FieldRenderer
        field={createTemplateField({
          field_type: 'yes_no',
          options: {
            onNo: {
              showTextField: true,
              textFieldLabel: 'Motivo da NC',
              textFieldRequired: true,
            },
          },
        })}
        value={{ answer: 'nao' }}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText('Motivo da NC')).toBeInTheDocument()
  })

  it('nao mostra campos condicionais quando resposta nao ativa config', () => {
    render(
      <FieldRenderer
        field={createTemplateField({
          field_type: 'yes_no',
          options: {
            onNo: {
              showTextField: true,
              textFieldLabel: 'Motivo da NC',
            },
          },
        })}
        value={{ answer: 'sim' }}
        onChange={vi.fn()}
      />
    )
    expect(screen.queryByText('Motivo da NC')).not.toBeInTheDocument()
  })

  it('mostra secao de plano de acao quando allowUserActionPlan e resposta Nao', async () => {
    render(
      <FieldRenderer
        field={createTemplateField({
          field_type: 'yes_no',
          options: {
            onNo: { allowUserActionPlan: true },
          },
        })}
        value={{ answer: 'nao' }}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText('Plano de Acao')).toBeInTheDocument()
  })

  it('nao mostra plano de acao quando resposta e Sim', () => {
    render(
      <FieldRenderer
        field={createTemplateField({
          field_type: 'yes_no',
          options: {
            onNo: { allowUserActionPlan: true },
          },
        })}
        value={{ answer: 'sim' }}
        onChange={vi.fn()}
      />
    )
    expect(screen.queryByText('Plano de Acao')).not.toBeInTheDocument()
  })

  it('mostra botao de foto quando allowPhoto=true', () => {
    render(
      <FieldRenderer
        field={createTemplateField({
          field_type: 'yes_no',
          options: { allowPhoto: true },
        })}
        value="sim"
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText(/Anexar Foto/)).toBeInTheDocument()
  })

  it('nao mostra botao de foto quando allowPhoto nao configurado', () => {
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'yes_no' })}
        value="sim"
        onChange={vi.fn()}
      />
    )
    expect(screen.queryByText(/Anexar Foto/)).not.toBeInTheDocument()
  })

  it('limpa dados condicionais ao trocar resposta para uma sem config', () => {
    const onChange = vi.fn()
    render(
      <FieldRenderer
        field={createTemplateField({
          field_type: 'yes_no',
          options: {
            onNo: { showTextField: true },
          },
        })}
        value={{ answer: 'nao', conditionalText: 'Motivo anterior' }}
        onChange={onChange}
      />
    )
    // Switch to Sim (which has no conditional config)
    fireEvent.click(screen.getByText('Sim'))
    expect(onChange).toHaveBeenCalledWith('sim')
  })
})

// ============================================
// RatingField
// ============================================

describe('RatingField', () => {
  it('renderiza 4 opcoes de rating com emojis', () => {
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'rating' })}
        value=""
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText('Pessimo')).toBeInTheDocument()
    expect(screen.getByText('Ruim')).toBeInTheDocument()
    expect(screen.getByText('Regular')).toBeInTheDocument()
    expect(screen.getByText('Bom')).toBeInTheDocument()
  })

  it('chama onChange com valor do rating selecionado', () => {
    const onChange = vi.fn()
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'rating' })}
        value=""
        onChange={onChange}
      />
    )
    fireEvent.click(screen.getByText('Bom'))
    expect(onChange).toHaveBeenCalledWith('bom')
  })

  it('aplica escala no item selecionado', () => {
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'rating' })}
        value="ruim"
        onChange={vi.fn()}
      />
    )
    const ruimButton = screen.getByText('Ruim').closest('button')!
    expect(ruimButton.style.transform).toBe('scale(1.15)')
  })

  it('item nao selecionado nao tem escala', () => {
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'rating' })}
        value="ruim"
        onChange={vi.fn()}
      />
    )
    const bomButton = screen.getByText('Bom').closest('button')!
    expect(bomButton.style.transform).toBe('scale(1)')
  })
})

// ============================================
// GPSField
// ============================================

describe('GPSField', () => {
  it('mostra botao capturar localizacao quando sem valor', () => {
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'gps' })}
        value={null}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText('Capturar Localização')).toBeInTheDocument()
  })

  it('mostra coordenadas quando valor ja capturado', () => {
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'gps' })}
        value={{ latitude: -8.05428, longitude: -34.87117, accuracy: 10, timestamp: '2026-03-18T14:00:00Z' }}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText('Localização capturada')).toBeInTheDocument()
    expect(screen.getByText(/Lat: -8.054280/)).toBeInTheDocument()
    expect(screen.getByText(/Precisão: 10m/)).toBeInTheDocument()
  })

  it('chama onChange ao capturar GPS com sucesso', async () => {
    const onChange = vi.fn()
    const mockGeolocation = {
      getCurrentPosition: vi.fn((success: PositionCallback) => {
        success({
          coords: { latitude: -8.05, longitude: -34.87, accuracy: 5 },
          timestamp: Date.now(),
        } as GeolocationPosition)
      }),
    }
    Object.defineProperty(navigator, 'geolocation', { value: mockGeolocation, configurable: true })
    // Mock permissions API
    Object.defineProperty(navigator, 'permissions', {
      value: { query: vi.fn().mockResolvedValue({ state: 'granted' }) },
      configurable: true,
    })

    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'gps' })}
        value={null}
        onChange={onChange}
      />
    )
    fireEvent.click(screen.getByText('Capturar Localização'))

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          latitude: -8.05,
          longitude: -34.87,
          accuracy: 5,
        })
      )
    })
  })

  it('mostra erro quando GPS nao suportado', async () => {
    Object.defineProperty(navigator, 'geolocation', { value: undefined, configurable: true })

    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'gps' })}
        value={null}
        onChange={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('Capturar Localização'))
    expect(screen.getByText('GPS não suportado neste dispositivo')).toBeInTheDocument()
  })

  it('mostra erro quando permissao negada', async () => {
    const mockGeolocation = {
      getCurrentPosition: vi.fn((_success: PositionCallback, error: PositionErrorCallback) => {
        error({ code: 1, message: 'User denied', PERMISSION_DENIED: 1 } as GeolocationPositionError)
      }),
    }
    Object.defineProperty(navigator, 'geolocation', { value: mockGeolocation, configurable: true })
    Object.defineProperty(navigator, 'permissions', {
      value: { query: vi.fn().mockResolvedValue({ state: 'prompt' }) },
      configurable: true,
    })

    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'gps' })}
        value={null}
        onChange={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('Capturar Localização'))

    await waitFor(() => {
      expect(screen.getByText(/Permissão de localização negada/)).toBeInTheDocument()
    })
  })
})

// ============================================
// PhotoField
// ============================================

describe('PhotoField', () => {
  it('mostra botao de captura quando sem fotos', () => {
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'photo' })}
        value={[]}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText(/Tirar Foto/)).toBeInTheDocument()
    // Text "(0/3)" is split across elements, use a regex on the full button text
    expect(screen.getByText(/0\/3/)).toBeInTheDocument()
  })

  it('mostra contagem de fotos correta', () => {
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'photo' })}
        value={['data:image/jpeg;base64,abc', 'data:image/jpeg;base64,def']}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText(/2\/3/)).toBeInTheDocument()
  })

  it('oculta botao quando atingiu max de fotos', () => {
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'photo' })}
        value={['a', 'b', 'c']}
        onChange={vi.fn()}
      />
    )
    expect(screen.queryByText(/Tirar Foto/)).not.toBeInTheDocument()
  })

  it('respeita maxPhotos customizado', () => {
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'photo', options: { maxPhotos: 5 } })}
        value={['a', 'b', 'c']}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText(/3\/5/)).toBeInTheDocument()
  })

  it('renderiza imagens das fotos existentes', () => {
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'photo' })}
        value={['data:image/jpeg;base64,abc']}
        onChange={vi.fn()}
      />
    )
    const img = screen.getByAltText('Foto 1')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', 'data:image/jpeg;base64,abc')
  })

  it('remove foto ao clicar no botao de remover', () => {
    const onChange = vi.fn()
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'photo' })}
        value={['photo1', 'photo2']}
        onChange={onChange}
      />
    )
    // Click the first remove button (X)
    const removeButtons = document.querySelectorAll('button[type="button"]')
    // Find the remove button (inside the photo grid, not the capture button)
    const removeBtn = Array.from(removeButtons).find(btn =>
      btn.closest('.aspect-square')
    )
    if (removeBtn) {
      fireEvent.click(removeBtn)
      expect(onChange).toHaveBeenCalledWith(['photo2'])
    }
  })

  it('funciona com value null', () => {
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'photo' })}
        value={null}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText(/Tirar Foto/)).toBeInTheDocument()
  })
})

// ============================================
// SignatureField
// ============================================

describe('SignatureField', () => {
  it('renderiza canvas para assinatura', () => {
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'signature' })}
        value={null}
        onChange={vi.fn()}
      />
    )
    expect(document.querySelector('canvas')).toBeInTheDocument()
  })

  it('mostra texto "Assine aqui" quando sem assinatura', () => {
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'signature' })}
        value={null}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText('Assine aqui')).toBeInTheDocument()
  })

  it('mostra botao limpar quando tem assinatura previa', () => {
    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'signature' })}
        value={{ dataUrl: 'data:image/png;base64,abc', timestamp: '2026-03-18T14:00:00Z' }}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText('Limpar assinatura')).toBeInTheDocument()
  })

  it('chama onChange(null) ao limpar assinatura', () => {
    const onChange = vi.fn()
    // Mock canvas getContext to avoid null issues in happy-dom
    const originalGetContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext

    render(
      <FieldRenderer
        field={createTemplateField({ field_type: 'signature' })}
        value={{ dataUrl: 'data:image/png;base64,abc', timestamp: '2026-03-18T14:00:00Z' }}
        onChange={onChange}
      />
    )
    fireEvent.click(screen.getByText('Limpar assinatura'))
    expect(onChange).toHaveBeenCalledWith(null)

    HTMLCanvasElement.prototype.getContext = originalGetContext
  })
})
