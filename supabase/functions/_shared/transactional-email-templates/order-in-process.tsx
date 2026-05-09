import * as React from 'npm:react@18.3.1'
import {
  Body, Img, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Menlifoot'
const GOLD = '#D4AF37'
const BLACK = '#0a0a0a'

interface Props {
  customerName?: string
  orderReference?: string
}

const OrderInProcessEmail = ({ customerName, orderReference = 'MF-XXXXXXXXXX' }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {SITE_NAME} order is now in production</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img src="https://tjotexujwnfltszqqovk.supabase.co/storage/v1/object/public/email-assets/menlifoot-ball.png" alt="Menlifoot" width="72" height="72" style={logo} />
          <Heading style={brand}>{SITE_NAME.toUpperCase()}</Heading>
          <Text style={tagline}>Order in production</Text>
        </Section>
        <Section style={card}>
          <Heading style={h1}>
            {customerName ? `Hey ${customerName},` : 'Good news!'}
          </Heading>
          <Text style={text}>
            Your jersey is now in production. We're customizing it with your name
            and number, and will let you know as soon as it ships.
          </Text>
          <Hr style={hr} />
          <Text style={label}>Order reference</Text>
          <Text style={reference}>{orderReference}</Text>
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
  component: OrderInProcessEmail,
  subject: 'Your Menlifoot order is in production',
  displayName: 'Order in process',
  previewData: { customerName: 'Alex', orderReference: 'MF-AB12CD34EF' },
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
const footer: React.CSSProperties = { textAlign: 'center', padding: '24px 0 12px' }
const footerText: React.CSSProperties = { color: '#999999', fontSize: '12px', margin: '0 0 8px' }
const footerBrand: React.CSSProperties = { color: GOLD, fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', margin: 0 }
