/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ siteName, confirmationUrl }: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your login link for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={brand}>{siteName.toUpperCase()}</Heading>
          <Text style={tagline}>Sign-in link</Text>
        </Section>
        <Section style={card}>
          <Heading style={h1}>Your login link</Heading>
          <Text style={text}>Click below to sign in. This link will expire shortly.</Text>
          <Button style={button} href={confirmationUrl}>Sign in</Button>
          <Hr style={hr} />
          <Text style={footer}>
            If you didn't request this, you can safely ignore this email.
          </Text>
        </Section>
        <Text style={brandFooter}>{siteName} — menlifoot.ca</Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const GOLD = '#D4AF37'
const BLACK = '#0a0a0a'
const main: React.CSSProperties = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif', margin: 0, padding: 0 }
const container: React.CSSProperties = { maxWidth: '560px', margin: '0 auto', padding: '24px 16px' }
const header: React.CSSProperties = { textAlign: 'center', padding: '24px 0' }
const brand: React.CSSProperties = { color: GOLD, fontSize: '32px', fontWeight: 300, letterSpacing: '0.2em', margin: 0 }
const tagline: React.CSSProperties = { color: '#999', fontSize: '12px', letterSpacing: '0.15em', textTransform: 'uppercase', margin: '8px 0 0' }
const card: React.CSSProperties = { backgroundColor: BLACK, borderRadius: '12px', padding: '32px 28px', border: `1px solid ${GOLD}33`, textAlign: 'center' }
const h1: React.CSSProperties = { color: GOLD, fontSize: '22px', fontWeight: 300, letterSpacing: '0.05em', margin: '0 0 16px', textTransform: 'uppercase' }
const text: React.CSSProperties = { color: '#e5e5e5', fontSize: '14px', lineHeight: '1.6', margin: '0 0 24px' }
const button: React.CSSProperties = { backgroundColor: GOLD, color: BLACK, fontSize: '13px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', borderRadius: '8px', padding: '14px 28px', textDecoration: 'none', display: 'inline-block' }
const hr: React.CSSProperties = { borderColor: `${GOLD}33`, margin: '24px 0 16px' }
const footer: React.CSSProperties = { fontSize: '12px', color: '#999', margin: 0 }
const brandFooter: React.CSSProperties = { textAlign: 'center', color: GOLD, fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', margin: '24px 0 8px' }
