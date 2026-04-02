import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

export interface VerifyOtpEmailProps {
  otp: string;
  expiresInMinutes: number;
  brandName?: string;
  supportEmail?: string;
  year?: number;
}

export function VerifyOtpEmail({
  otp,
  expiresInMinutes,
  brandName = "Daily Express",
  supportEmail = "support@dailyexpress.com",
  year = new Date().getFullYear(),
}: VerifyOtpEmailProps) {
  const previewText = `${otp} is your ${brandName} verification code`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={page}>
          <Section style={brandSection}>
            <Text style={brandText}>{brandName}</Text>
          </Section>

          <Container style={card}>
            <Text style={title}>Multi-Factor Authentication</Text>
            <Text style={subtitle}>
              Please use the one-time-password (OTP) below:
            </Text>

            <Text style={otpText}>{otp}</Text>
            <Text style={expiryText}>
              The OTP will expire in {expiresInMinutes} minutes.
            </Text>

            <Section style={divider} />

            <Text style={bodyText}>
              If you did not initiate this OTP request, we strongly advise you
              reset your password immediately to secure your account and notify
              us as soon as possible via{" "}
              <Link href={`mailto:${supportEmail}`} style={link}>
                {supportEmail}
              </Link>
              .
            </Text>

            <Text style={thanksText}>Thank you.</Text>

            <Text style={footerText}>
              &copy; {brandName} {year}
            </Text>
            <Text style={footerSubtext}>Reliable travel across Africa</Text>
          </Container>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: "#ffffff",
  color: "#0f172a",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  margin: 0,
  padding: "0",
};

const page = {
  margin: "0 auto",
  maxWidth: "900px",
  padding: "72px 24px 32px",
};

const brandSection = {
  padding: "0 24px 28px",
};

const brandText = {
  color: "#0f172a",
  fontSize: "38px",
  fontWeight: "800",
  letterSpacing: "-1px",
  lineHeight: "42px",
  margin: "0",
};

const card = {
  border: "1px solid #cbd5e1",
  borderRadius: "18px",
  padding: "48px 60px 44px",
};

const title = {
  color: "#101828",
  fontSize: "40px",
  fontWeight: "700",
  letterSpacing: "-1px",
  lineHeight: "46px",
  margin: "0 0 24px",
};

const subtitle = {
  color: "#5f6358",
  fontSize: "26px",
  lineHeight: "38px",
  margin: "0 0 40px",
};

const otpText = {
  color: "#101828",
  fontSize: "56px",
  fontWeight: "700",
  letterSpacing: "-1px",
  lineHeight: "1.1",
  margin: "0 0 40px",
};

const expiryText = {
  color: "#5f6358",
  fontSize: "24px",
  lineHeight: "36px",
  margin: "0 0 36px",
};

const divider = {
  borderTop: "1px solid #cbd5e1",
  margin: "0 0 40px",
};

const bodyText = {
  color: "#5f6358",
  fontSize: "24px",
  lineHeight: "38px",
  margin: "0 0 40px",
};

const link = {
  color: "#2458d3",
  textDecoration: "underline",
};

const thanksText = {
  color: "#5f6358",
  fontSize: "24px",
  lineHeight: "36px",
  margin: "0 0 56px",
};

const footerText = {
  color: "#5f6358",
  fontSize: "20px",
  lineHeight: "30px",
  margin: "0",
  textAlign: "center" as const,
};

const footerSubtext = {
  color: "#5f6358",
  fontSize: "18px",
  lineHeight: "28px",
  margin: "4px 0 0",
  textAlign: "center" as const,
};
