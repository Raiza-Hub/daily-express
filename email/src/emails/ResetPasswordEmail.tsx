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

export interface ResetPasswordEmailProps {
  resetUrl: string;
  brandName?: string;
  supportEmail?: string;
  year?: number;
  frontendUrl?: string;
}

const ResetPasswordEmail = ({
  resetUrl,
  brandName = "Daily Express",
  supportEmail = "support@dailyexpress.com",
  year = new Date().getFullYear(),
  frontendUrl,
}: ResetPasswordEmailProps) => {
  const assetBaseUrl = frontendUrl || "";
  const previewText = `Reset your ${brandName} password`;

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
            <Text style={title}>{brandName} password reset</Text>
            <Text style={bodyText}>Dear {brandName} user,</Text>
            <Text style={bodyText}>
              We&apos;ve received your request to reset your password. Please
              click the link below to complete the reset.
            </Text>

            <Section style={buttonRow}>
              <Link href={resetUrl} style={button}>
                Reset My Password
              </Link>
            </Section>

            <Text style={bodyText}>
              If you need additional assistance, or you did not make this
              change, please contact{" "}
              <Link href={`mailto:${supportEmail}`} style={link}>
                {supportEmail}
              </Link>
              .
            </Text>

            <Section style={divider} />

            <Text style={footerText}>
              &copy; {year} {brandName}. All rights reserved.
            </Text>
          </Container>
        </Container>
      </Body>
    </Html>
  );
};

const main = {
  backgroundColor: "#ffffff",
  color: "#202124",
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
  color: "#202124",
  fontSize: "16px",
  fontWeight: "700",
  lineHeight: "24px",
  margin: "0 0 20px",
};

const bodyText = {
  color: "#202124",
  fontSize: "14px",
  lineHeight: "22px",
  margin: "0 0 16px",
};

const buttonRow = {
  margin: "8px 0 24px",
};

const button = {
  backgroundColor: "#1a56db",
  borderRadius: "8px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: "600",
  lineHeight: "14px",
  padding: "12px 20px",
  textDecoration: "none",
};

const link = {
  color: "#2458d3",
  textDecoration: "underline",
};

const divider = {
  borderTop: "1px solid #e4e7ec",
  margin: "20px 0 20px",
};

const footerText = {
  color: "#98a2b3",
  fontSize: "13px",
  lineHeight: "20px",
  margin: "0",
};

ResetPasswordEmail.PreviewProps = {
  resetUrl: "http://localhost:3000/reset-password?token=preview-token",
  brandName: "Daily Express",
  supportEmail: "support@dailyexpress.com",
  year: 2026,
  frontendUrl: "",
} as ResetPasswordEmailProps;

export default ResetPasswordEmail;