import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { getEmailLogoSrc } from "../assets";

export interface RefundSuccessfulEmailProps {
  frontendUrl: string;
  customerName: string | null;
  customerEmail: string;
  paymentReference: string;
  bookingId?: string | null;
  amountMinor: number;
  currency?: string;
  productName: string;
  supportEmail?: string;
  supportPhone?: string;
}

function formatCurrency(amountMinor: number, currency: string = "NGN") {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amountMinor / 100);
}

const RefundSuccessfulEmail = ({
  customerName,
  amountMinor,
  currency = "NGN",
  productName,
  supportEmail = "support@dailyexpress.app",
  supportPhone = "+234 9063611541",
}: RefundSuccessfulEmailProps) => {
  const greetingName = customerName || "Valued Customer";
  const previewText = "Your refund has been successfully processed";

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={page}>
          <Section style={brandSection}>
            <Img
              src={getEmailLogoSrc()}
              alt="Daily Express Logo"
              width="112"
              height="40"
              style={logo}
            />
          </Section>

          <Container style={card}>
            <Text style={greeting}>Dear {greetingName},</Text>

            <Text style={summary}>
              Your refund of{" "}
              <strong style={strong}>{formatCurrency(amountMinor, currency)}</strong>{" "}
              for your <strong style={strong}>{productName}</strong> booking has been
              successfully processed.
            </Text>

            <Hr style={divider} />

            <Text style={supportText}>
              If you have any questions about this refund or need further assistance,
              please contact our support team:
            </Text>
            <Text style={supportText}>
              Phone: <strong style={strong}>{supportPhone}</strong>
            </Text>
            <Text style={supportText}>
              Email:{" "}
              <Link href={`mailto:${supportEmail}`} style={supportLink}>
                {supportEmail}
              </Link>
            </Text>

            <Hr style={divider} />

            <Text style={footerText}>
              Thank you for choosing Daily Express.
            </Text>
            <Text style={footerText}>The Daily Express Team</Text>
          </Container>
        </Container>
      </Body>
    </Html>
  );
};

const main = {
  backgroundColor: "#ffffff",
  color: "#333",
  fontFamily: "'Helvetica Neue', Arial, sans-serif",
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
  textAlign: "center" as const,
};

const logo = {
  display: "inline-block",
  height: "40px",
  width: "112px",
};

const card = {
  borderRadius: "0 0 12px 12px",
  padding: "32px 40px 28px",
};

const greeting = {
  color: "#111",
  fontSize: "14px",
  marginBottom: "8px",
};

const summary = {
  color: "#111",
  fontSize: "14px",
  lineHeight: "22px",
  marginBottom: "14px",
};

const divider = {
  borderTop: "1px solid #e4e7ec",
  margin: "24px 0",
};

const supportText = {
  color: "#333",
  fontSize: "13px",
  lineHeight: "21px",
  marginBottom: "6px",
};

const supportLink = {
  color: "#2563eb",
  textDecoration: "none",
};

const strong = {
  color: "#111",
};

const footerText = {
  color: "#666",
  fontSize: "12px",
  margin: "4px 0",
  textAlign: "center" as const,
};

RefundSuccessfulEmail.PreviewProps = {
  frontendUrl: "",
  customerName: "Chioma Nwosu",
  customerEmail: "chioma@example.com",
  paymentReference: "PAY-REF-2026-001",
  bookingId: "booking_01JXYZ",
  amountMinor: 1250000,
  currency: "NGN",
  productName: "Lagos to Abuja Trip",
  supportEmail: "support@dailyexpress.app",
  supportPhone: "+234 9063611541",
} as RefundSuccessfulEmailProps;

export default RefundSuccessfulEmail;
