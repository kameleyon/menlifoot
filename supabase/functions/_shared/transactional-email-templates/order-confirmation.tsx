import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Row,
  Column,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Menlifoot'
const GOLD = '#D4AF37'
const BLACK = '#0a0a0a'

interface OrderItem {
  name: string
  variant?: string
  quantity: number
}

interface OrderConfirmationProps {
  customerName?: string
  orderReference?: string
  items?: OrderItem[]
  subtotal?: string
  shipping?: string
  tax?: string
  total?: string
  shippingAddress?: string
  estimatedDelivery?: string
}

const OrderConfirmationEmail = ({
  customerName,
  orderReference = 'MF-XXXXXXXXXX',
  items = [],
  subtotal,
  shipping,
  tax,
  total,
  shippingAddress,
  estimatedDelivery,
}: OrderConfirmationProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {SITE_NAME} pre-order is confirmed</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={brand}>{SITE_NAME.toUpperCase()}</Heading>
          <Text style={tagline}>Pre-order confirmed</Text>
        </Section>

        <Section style={card}>
          <Heading style={h1}>
            {customerName ? `Thanks, ${customerName}!` : 'Thanks for your order!'}
          </Heading>
          <Text style={text}>
            We've received your pre-order. Your jersey is moving into production
            and we'll keep you updated as it ships.
          </Text>

          <Hr style={hr} />

          <Text style={label}>Order reference</Text>
          <Text style={reference}>{orderReference}</Text>

          {items.length > 0 && (
            <>
              <Hr style={hr} />
              <Text style={label}>Items</Text>
              {items.map((it, i) => (
                <Row key={i} style={itemRow}>
                  <Column>
                    <Text style={itemName}>{it.name}</Text>
                    {it.variant && <Text style={itemVariant}>{it.variant}</Text>}
                  </Column>
                  <Column style={{ textAlign: 'right' }}>
                    <Text style={itemQty}>×{it.quantity}</Text>
                  </Column>
                </Row>
              ))}
            </>
          )}

          {(subtotal || shipping || tax || total) && (
            <>
              <Hr style={hr} />
              {subtotal && (
                <Row>
                  <Column><Text style={text}>Subtotal</Text></Column>
                  <Column style={{ textAlign: 'right' }}>
                    <Text style={text}>{subtotal}</Text>
                  </Column>
                </Row>
              )}
              {shipping && (
                <Row>
                  <Column><Text style={text}>Shipping</Text></Column>
                  <Column style={{ textAlign: 'right' }}>
                    <Text style={text}>{shipping}</Text>
                  </Column>
                </Row>
              )}
              {tax && (
                <Row>
                  <Column><Text style={text}>Tax</Text></Column>
                  <Column style={{ textAlign: 'right' }}>
                    <Text style={text}>{tax}</Text>
                  </Column>
                </Row>
              )}
              {total && (
                <Row>
                  <Column><Text style={totalLabel}>Total</Text></Column>
                  <Column style={{ textAlign: 'right' }}>
                    <Text style={totalAmount}>{total}</Text>
                  </Column>
                </Row>
              )}
            </>
          )}

          {shippingAddress && (
            <>
              <Hr style={hr} />
              <Text style={label}>Shipping to</Text>
              <Text style={text}>{shippingAddress}</Text>
            </>
          )}

          {estimatedDelivery && (
            <>
              <Hr style={hr} />
              <Text style={label}>Estimated delivery</Text>
              <Text style={text}>{estimatedDelivery}</Text>
            </>
          )}
        </Section>

        <Section style={footer}>
          <Text style={footerText}>
            Questions? Reply to this email and we'll get back to you.
          </Text>
          <Text style={footerBrand}>{SITE_NAME} — menlifoot.ca</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: OrderConfirmationEmail,
  subject: 'Your Menlifoot pre-order is confirmed',
  displayName: 'Order confirmation',
  previewData: {
    customerName: 'Alex',
    orderReference: 'MF-AB12CD34EF',
    items: [
      { name: 'Menlifoot Jersey — Black', variant: 'Size L', quantity: 1 },
      { name: 'Menlifoot Jersey — White', variant: 'Size M', quantity: 2 },
    ],
    subtotal: 'CA$240.00',
    shipping: 'CA$12.00',
    tax: 'CA$37.80',
    total: 'CA$289.80',
    shippingAddress: '123 Rue Saint-Denis, Montreal, QC H2X 3K8, Canada',
    estimatedDelivery: '3-7 business days after production completes',
  },
} satisfies TemplateEntry

const main: React.CSSProperties = {
  backgroundColor: '#ffffff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
  margin: 0,
  padding: 0,
}
const container: React.CSSProperties = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '24px 16px',
}
const header: React.CSSProperties = {
  textAlign: 'center',
  padding: '24px 0',
}
const brand: React.CSSProperties = {
  color: GOLD,
  fontSize: '32px',
  fontWeight: 300,
  letterSpacing: '0.2em',
  margin: 0,
}
const tagline: React.CSSProperties = {
  color: '#999999',
  fontSize: '12px',
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
  margin: '8px 0 0',
}
const card: React.CSSProperties = {
  backgroundColor: BLACK,
  borderRadius: '12px',
  padding: '32px 28px',
  border: `1px solid ${GOLD}33`,
}
const h1: React.CSSProperties = {
  color: GOLD,
  fontSize: '22px',
  fontWeight: 300,
  letterSpacing: '0.05em',
  margin: '0 0 12px',
  textTransform: 'uppercase',
}
const text: React.CSSProperties = {
  color: '#e5e5e5',
  fontSize: '14px',
  lineHeight: '1.6',
  margin: '4px 0',
}
const label: React.CSSProperties = {
  color: GOLD,
  fontSize: '11px',
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
  margin: '0 0 4px',
}
const reference: React.CSSProperties = {
  color: GOLD,
  fontSize: '18px',
  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
  letterSpacing: '0.1em',
  margin: '4px 0 0',
}
const hr: React.CSSProperties = {
  borderColor: `${GOLD}33`,
  margin: '20px 0',
}
const itemRow: React.CSSProperties = {
  marginBottom: '8px',
}
const itemName: React.CSSProperties = {
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 500,
  margin: 0,
}
const itemVariant: React.CSSProperties = {
  color: '#999999',
  fontSize: '12px',
  margin: '2px 0 0',
}
const itemQty: React.CSSProperties = {
  color: GOLD,
  fontSize: '14px',
  margin: 0,
}
const totalLabel: React.CSSProperties = {
  color: GOLD,
  fontSize: '14px',
  fontWeight: 600,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  margin: '8px 0 0',
}
const totalAmount: React.CSSProperties = {
  color: GOLD,
  fontSize: '16px',
  fontWeight: 600,
  margin: '8px 0 0',
}
const footer: React.CSSProperties = {
  textAlign: 'center',
  padding: '24px 0 12px',
}
const footerText: React.CSSProperties = {
  color: '#999999',
  fontSize: '12px',
  margin: '0 0 8px',
}
const footerBrand: React.CSSProperties = {
  color: GOLD,
  fontSize: '11px',
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  margin: 0,
}
