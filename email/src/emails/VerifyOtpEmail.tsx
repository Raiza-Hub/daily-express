import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export interface VerifyOtpEmailProps {
  otp: string;
  expiresInMinutes: number;
  brandName?: string;
  supportEmail?: string;
  year?: number;
  frontendUrl?: string;
}

const VerifyOtpEmail = ({
  otp,
  expiresInMinutes,
  brandName = "Daily Express",
  supportEmail = "support@dailyexpress.com",
  year = new Date().getFullYear(),
  frontendUrl,
}: VerifyOtpEmailProps) => {
  const assetBaseUrl = frontendUrl || "";
  const previewText = `${otp} is your ${brandName} verification code`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={page}>
          <Section style={brandSection}>
            <Img
              src={`${assetBaseUrl}/static/email-logo.png`}
              alt="Daily Express Logo"
              height="40"
              style={logo}
            />
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
            <Text style={footerSubtext}>Reliable travel across Nigeria</Text>
          </Container>
        </Container>
      </Body>
    </Html>
  );
};

const main = {
  backgroundColor: "#ffffff",
  color: "#0f172a",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  margin: 0,
  padding: "0",
};

const page = {
  margin: "0 auto",
  maxWidth: "600px",
  padding: "0 0 32px",
};

const brandSection = {
  backgroundColor: "#0f172a",
  borderRadius: "12px 12px 0 0",
  padding: "24px 40px",
  marginBottom: "0",
};

const logo = {
  display: "block",
};

const card = {
  borderRadius: "0 0 12px 12px",
  padding: "32px 40px 28px",
};

const title = {
  color: "#101828",
  fontSize: "16px",
  fontWeight: "700",
  lineHeight: "24px",
  margin: "0 0 8px",
};

const subtitle = {
  color: "#475467",
  fontSize: "14px",
  lineHeight: "22px",
  margin: "0 0 24px",
};

const otpText = {
  color: "#101828",
  fontSize: "32px",
  fontWeight: "700",
  letterSpacing: "-0.5px",
  lineHeight: "1.2",
  margin: "0 0 20px",
};

const expiryText = {
  color: "#475467",
  fontSize: "14px",
  lineHeight: "22px",
  margin: "0 0 24px",
};

const divider = {
  borderTop: "1px solid #e4e7ec",
  margin: "0 0 24px",
};

const bodyText = {
  color: "#475467",
  fontSize: "14px",
  lineHeight: "22px",
  margin: "0 0 24px",
};

const link = {
  color: "#2458d3",
  textDecoration: "underline",
};

const thanksText = {
  color: "#475467",
  fontSize: "14px",
  lineHeight: "22px",
  margin: "0 0 32px",
};

const footerText = {
  color: "#98a2b3",
  fontSize: "13px",
  lineHeight: "20px",
  margin: "0",
  textAlign: "center" as const,
};

const footerSubtext = {
  color: "#98a2b3",
  fontSize: "12px",
  lineHeight: "18px",
  margin: "2px 0 0",
  textAlign: "center" as const,
};

VerifyOtpEmail.PreviewProps = {
  otp: "916617",
  expiresInMinutes: 30,
  brandName: "Daily Express",
  supportEmail: "support@dailyexpress.com",
  year: 2026,
  frontendUrl: "",
} as VerifyOtpEmailProps;

export default VerifyOtpEmail;