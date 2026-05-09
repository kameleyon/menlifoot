import * as React from 'npm:react@18.3.1'
import {
  Body, Img, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Menlifoot'
const GOLD = '#D4AF37'
const BLACK = '#0a0a0a'

interface Props {
  customerName?: string
  orderReference?: string
  trackingNumber?: string
  carrier?: string
  trackingUrl?: string
  shippingAddress?: string
}

const OrderShippedEmail = ({
  customerName,
  orderReference = 'MF-XXXXXXXXXX',
  trackingNumber,
  carrier,
  trackingUrl,
  shippingAddress,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {SITE_NAME} order has shipped</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img src="https://tjotexujwnfltszqqovk.supabase.co/storage/v1/object/public/email-assets/menlifoot-ball.png" alt="Menlifoot" width="72" height="72" style={logo} />
          <Heading style={brand}>{SITE_NAME.toUpperCase()}</Heading>
          <Text style={tagline}>Shipped</Text>
        </Section>
        <Section style={card}>
          <Heading style={h1}>
            {customerName ? `${customerName}, it's on its way!` : "It's on its way!"}
          </Heading>
          <Text style={text}>
            Your jersey has shipped{carrier ? ` via ${carrier}` : ''}. Track it
            with the link below.
          </Text>

          <Hr style={hr} />
          <Text style={label}>Order reference</Text>
          <Text style={reference}>{orderReference}</Text>

          {trackingNumber && (
            <>
              <Hr style={hr} />
              <Text style={label}>Tracking number</Text>
              <Text style={reference}>{trackingNumber}</Text>
            </>
          )}

          {trackingUrl && (
            <Section style={{ textAlign: 'center', marginTop: '24px' }}>
              <Button href={trackingUrl} style={btn}>Track package</Button>
            </Section>
          )}

          {shippingAddress && (
            <>
              <Hr style={hr} />
              <Text style={label}>Shipping to</Text>
              <Text style={text}>{shippingAddress}</Text>
            </>
          )}
        </Section>
        <Section style={footer}>
          <Text style={footerText}>Questions? Reply to this email.</Text>
          <Text style={footerBrand}>{SITE_NAME} — menlifoot.ca</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: OrderShippedEmail,
  subject: 'Your Menlifoot order has shipped',
  displayName: 'Order shipped',
  previewData: {
    customerName: 'Alex',
    orderReference: 'MF-AB12CD34EF',
    trackingNumber: '1Z999AA10123456784',
    carrier: 'UPS',
    trackingUrl: 'https://www.ups.com/track?tracknum=1Z999AA10123456784',
    shippingAddress: '123 Rue Saint-Denis, Montreal, QC H2X 3K8, Canada',
  },
} satisfies TemplateEntry

const main: React.CSSProperties = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif', margin: 0, padding: 0 }
const container: React.CSSProperties = { maxWidth: '560px', margin: '0 auto', padding: '24px 16px' }
const logo: React.CSSProperties = { display: 'block', margin: '0 auto 12px' }
const header: React.CSSProperties = { textAlign: 'center', padding: '24px 0' }
const brand: React.CSSProperties = { color: GOLD, fontSize: '32px', fontWeight: 300, letterSpacing: '0.2em', margin: 0 }
const tagline: React.CSSProperties = { color: '#999999', fontSize: '12px', letterSpacing: '0.15em', textTransform: 'uppercase', margin: '8px 0 0' }
const card: React.CSSProperties = { backgroundColor: BLACK, borderRadius: '12px', padding: '32px 28px', border: `1px solid ${GOLD}33` }
const h1: React.CSSProperties = { color: GOLD, fontSize: '22px', fontWeight: 300, letterSpacing: '0.05em', margin: '0 0 12px', textTransform: 'uppercase' }
const text: React.CSSProperties = { color: '#e5e5e5', fontSize: '14px', lineHeight: '1.6', margin: '4px 0' }
const label: React.CSSProperties = { color: GOLD, fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 4px' }
const reference: React.CSSProperties = { color: GOLD, fontSize: '18px', fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', letterSpacing: '0.1em', margin: '4px 0 0' }
const hr: React.CSSProperties = { borderColor: `${GOLD}33`, margin: '20px 0' }
const btn: React.CSSProperties = { backgroundColor: GOLD, color: BLACK, padding: '12px 28px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none', display: 'inline-block' }
const footer: React.CSSProperties = { textAlign: 'center', padding: '24px 0 12px' }
const footerText: React.CSSProperties = { color: '#999999', fontSize: '12px', margin: '0 0 8px' }
const footerBrand: React.CSSProperties = { color: GOLD, fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', margin: 0 }
