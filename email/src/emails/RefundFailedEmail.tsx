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

export interface RefundFailedEmailProps {
  frontendUrl: string;
  customerName: string | null;
  customerEmail: string;
  paymentReference: string;
  bookingId?: string | null;
  amountMinor: number;
  currency?: string;
  productName: string;
  failureReason: string;
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

const RefundFailedEmail = ({
  frontendUrl = "",
  customerName,
  customerEmail,
  paymentReference,
  bookingId,
  amountMinor,
  currency = "NGN",
  productName,
  failureReason,
  supportEmail = "support@dailyexpress.com",
  supportPhone = "07008888328",
}: RefundFailedEmailProps) => {
  const greetingName = customerName || customerEmail;
  const previewText = "We could not complete your refund automatically";
  const assetBaseUrl = frontendUrl || "";

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={page}>
          {/* Dark logo header */}
          <Section style={brandSection}>
            <Img
              src={`${assetBaseUrl}/static/email-logo.png`}
              alt="Daily Express Logo"
              height="40"
              style={logo}
            />
          </Section>

          {/* Card body */}
          <Container style={card}>
            <Text style={greeting}>Dear {greetingName},</Text>

            <Text style={summary}>
              We sincerely apologize for the inconvenience. We attempted to process
              your refund of{" "}
              <strong style={strong}>{formatCurrency(amountMinor, currency)}</strong>{" "}
              for your <strong style={strong}>{productName}</strong> booking, but
              unfortunately we were unable to complete it automatically.
            </Text>

            <Text style={summary}>
              This can happen due to a bank processing delay, an expired transaction
              window, or a temporary issue on our payment provider's end. Please be
              assured that your money has not been lost. Your refund is still owed
              to you in full and our support team will follow up to resolve this
              manually.
            </Text>

            <Text style={summary}>
              Please review the refund details below and follow the steps outlined to
              help us process your refund as quickly as possible. We aim to resolve
              all manual refund cases within <strong style={strong}>3 to 5 business days</strong>.
            </Text>

            <Hr style={divider} />

            <Text style={sectionTitle}>Refund Details</Text>
            <Text style={detail}>
              Payment reference:{" "}
              <strong style={strong}>{paymentReference}</strong>
            </Text>
            <Text style={detail}>
              Booking ID:{" "}
              <strong style={strong}>{bookingId || "Unavailable"}</strong>
            </Text>
            <Text style={detail}>
              Amount:{" "}
              <strong style={strong}>
                {formatCurrency(amountMinor, currency)}
              </strong>
            </Text>
            <Text style={detail}>
              Reason:{" "}
              <strong style={strong}>
                {failureReason || "Refund attempt failed"}
              </strong>
            </Text>

            <Hr style={divider} />

            <Text style={sectionTitle}>What You Should Do Next</Text>
            <Text style={step}>
              1. Keep this payment reference for support follow-up.
            </Text>
            <Text style={step}>
              2. Do not retry this expired booking payment from your side.
            </Text>
            <Text style={step}>
              3. Contact support so we can complete the refund review quickly.
            </Text>

            <Hr style={divider} />

            <Text style={supportText}>
              For further enquiries, please contact our customer support through
              the following channels:
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

const sectionTitle = {
  color: "#111",
  fontSize: "14px",
  fontWeight: "bold" as const,
  marginBottom: "12px",
};

const detail = {
  color: "#333",
  fontSize: "13px",
  lineHeight: "20px",
  margin: "0 0 8px",
};

const step = {
  color: "#333",
  fontSize: "13px",
  lineHeight: "20px",
  margin: "0 0 8px",
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

RefundFailedEmail.PreviewProps = {
  frontendUrl: "",
  customerName: "Chioma Nwosu",
  customerEmail: "chioma@example.com",
  paymentReference: "PAY-REF-2026-001",
  bookingId: "booking_01JXYZ",
  amountMinor: 1250000,
  currency: "NGN",
  productName: "Lagos to Abuja Trip",
  failureReason: "Bank reversal timed out",
  supportEmail: "support@dailyexpress.com",
  supportPhone: "+234 9063611541",
} as RefundFailedEmailProps;

export default RefundFailedEmail;