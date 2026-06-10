/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

export interface WonNotificationProps {
  clientName?: string
  clientCnpj?: string
  productName?: string
  billingType?: string
  implementationValue?: string
  implBillingDate?: string
  monthlyValue?: string
  firstMonthlyDate?: string
  paymentConditions?: string
  financialContactName?: string
  financialContactEmail?: string
  sellerName?: string
  sellerEmail?: string
  attachments?: { name: string; url: string }[]
}

const formatDate = (dateStr?: string) => {
  if (!dateStr) return 'N/A'
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  const [y, m, d] = parts
  return `${d}/${m}/${y}`
}

const WonNotificationEmail = ({
  clientName = 'Cliente',
  clientCnpj = '—',
  productName = '—',
  billingType = 'recorrente',
  implementationValue = 'R$ 0,00',
  implBillingDate = '',
  monthlyValue = 'R$ 0,00',
  firstMonthlyDate = '',
  paymentConditions = '—',
  financialContactName = '—',
  financialContactEmail = '',
  sellerName = '—',
  sellerEmail = '',
  attachments = [],
}: WonNotificationProps) => {
  const billingLabel = billingType === 'pontual' ? 'Pontual' : 'Recorrente'

  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>
        Nova venda fechada — {clientName} • {productName}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={headerTitle}>🎉 Nova Venda Fechada!</Heading>
          </Section>

          <Section style={card}>
            <Heading as="h2" style={sectionTitle}>
              Dados do Cliente
            </Heading>
            <Row label="Cliente" value={clientName} bold />
            <Row label="CNPJ" value={clientCnpj} />
            <Row label="Produto" value={productName} />
            <Row label="Tipo de Cobrança" value={billingLabel} />

            <Hr style={hr} />

            <Heading as="h2" style={sectionTitle}>
              Informações Financeiras
            </Heading>
            <Row label="Valor de Implantação" value={implementationValue} bold />
            <Row label="Data Cobrança Implantação" value={formatDate(implBillingDate)} />
            <Row label="Valor da Mensalidade" value={monthlyValue} bold />
            <Row label="Data 1ª Mensalidade" value={formatDate(firstMonthlyDate)} />
            <Row label="Condições de Pagamento" value={paymentConditions} />

            <Hr style={hr} />

            <Heading as="h2" style={sectionTitle}>
              Contato Financeiro
            </Heading>
            <Row label="Nome" value={financialContactName} />
            <Row label="Email" value={financialContactEmail || 'N/A'} />

            <Hr style={hr} />

            <Heading as="h2" style={sectionTitle}>
              Vendedor
            </Heading>
            <Text style={text}>
              {sellerName}
              {sellerEmail ? ` (${sellerEmail})` : ''}
            </Text>

            {attachments.length > 0 && (
              <>
                <Hr style={hr} />
                <Heading as="h2" style={sectionTitle}>
                  Contrato
                </Heading>
                <Text style={text}>
                  Clique abaixo para acessar o(s) arquivo(s) do contrato:
                </Text>
                {attachments.map((att, i) => (
                  <Section key={i} style={{ marginBottom: '8px' }}>
                    <Button href={att.url} style={button}>
                      📎 {att.name}
                    </Button>
                  </Section>
                ))}
                <Text style={muted}>
                  Caso o botão não funcione, copie e cole o link no navegador:
                </Text>
                {attachments.map((att, i) => (
                  <Text key={i} style={linkText}>
                    <Link href={att.url} style={linkStyle}>
                      {att.url}
                    </Link>
                  </Text>
                ))}
              </>
            )}
          </Section>

          <Text style={footer}>
            Notificação automática enviada pelo CRM Evolua.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const Row = ({
  label,
  value,
  bold,
}: {
  label: string
  value: string
  bold?: boolean
}) => (
  <Text style={rowText}>
    <span style={rowLabel}>{label}:</span>{' '}
    <span style={{ ...rowValue, fontWeight: bold ? 700 : 400 }}>{value}</span>
  </Text>
)

export const template = {
  component: WonNotificationEmail,
  subject: (data: WonNotificationProps) =>
    `🎉 Nova Venda - ${data?.clientName ?? 'Cliente'} | ${data?.productName ?? ''}`,
  displayName: 'Nova Venda Fechada',
  previewData: {
    clientName: 'Empresa Exemplo LTDA',
    clientCnpj: '00.000.000/0001-00',
    productName: 'i-Ganhei',
    billingType: 'recorrente',
    implementationValue: 'R$ 2.500,00',
    implBillingDate: '2026-06-20',
    monthlyValue: 'R$ 890,00',
    firstMonthlyDate: '2026-07-20',
    paymentConditions: 'Boleto 30 dias',
    financialContactName: 'Maria Financeiro',
    financialContactEmail: 'financeiro@exemplo.com',
    sellerName: 'João Vendedor',
    sellerEmail: 'joao@startgi.com.br',
    attachments: [{ name: 'contrato.pdf', url: 'https://example.com/contrato.pdf' }],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 0', maxWidth: '600px', margin: '0 auto' }
const header = {
  backgroundColor: '#16a34a',
  borderRadius: '8px 8px 0 0',
  padding: '24px 20px',
  textAlign: 'center' as const,
}
const headerTitle = { color: '#ffffff', fontSize: '22px', margin: 0 }
const card = {
  border: '1px solid #e5e7eb',
  borderTop: 'none',
  borderRadius: '0 0 8px 8px',
  padding: '20px',
}
const sectionTitle = {
  color: '#111827',
  fontSize: '16px',
  borderBottom: '2px solid #16a34a',
  paddingBottom: '6px',
  marginTop: '16px',
  marginBottom: '12px',
}
const rowText = { margin: '6px 0', fontSize: '14px', color: '#111827', lineHeight: '1.5' }
const rowLabel = { color: '#6b7280' }
const rowValue = { color: '#111827' }
const text = { fontSize: '14px', color: '#111827', margin: '6px 0' }
const muted = { fontSize: '12px', color: '#6b7280', marginTop: '12px' }
const linkText = { fontSize: '12px', wordBreak: 'break-all' as const, margin: '4px 0' }
const linkStyle = { color: '#16a34a' }
const hr = { borderColor: '#e5e7eb', margin: '16px 0' }
const button = {
  backgroundColor: '#16a34a',
  color: '#ffffff',
  padding: '10px 18px',
  borderRadius: '6px',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: 600,
}
const footer = {
  fontSize: '12px',
  color: '#6b7280',
  textAlign: 'center' as const,
  marginTop: '16px',
}
