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
  Row,
  Column,
} from "@react-email/components";
import * as React from "react";

export interface PayoutFailedEmailProps {
  frontendUrl: string;
  driverName: string | null;
  driverEmail: string;
  amountMinor: number;
  koraFeeAmount: number;
  reference: string;
  failureReason: string;
  bankName: string;
  accountLast4: string;
}

function formatCurrency(amountMinor: number, currency: string = "NGN") {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amountMinor / 100);
}

const PayoutFailedEmail = ({
  frontendUrl = "",
  driverName,
  driverEmail,
  amountMinor,
  koraFeeAmount,
  reference,
  failureReason,
  bankName,
  accountLast4,
}: PayoutFailedEmailProps) => {
  const greetingName = driverName || driverEmail;
  const previewText = "Payout Failed - Action Required";
  const assetBaseUrl = frontendUrl || "";

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
            <Text style={summary}>
              Hello {greetingName},
            </Text>

            <Text style={summary}>
              We're sorry to inform you that your payout of{" "}
              <strong style={strong}>{formatCurrency(amountMinor)}</strong> to{" "}
              <strong style={strong}>{bankName} ****{accountLast4}</strong> was
              unsuccessful. Despite multiple attempts, we were unable to complete the
              transfer to your bank account.
            </Text>

            <Text style={summary}>
              This may be due to an issue with your bank account details, a temporary
              restriction on your account, or a problem on your bank's end. Please
              review the details below and follow the steps to resolve this as quickly
              as possible.
            </Text>

            <Text style={summary}>
              Your earnings are safe with us. Once the issue is resolved, we will
              re-initiate the payout to your account promptly.
            </Text>

            <Hr style={divider} />

            <Text style={sectionTitle}>Payout Details</Text>

            <Section style={infoTable}>
              <Row style={row}>
                <Column style={labelCol}>
                  <Text style={label}>Reference:</Text>
                </Column>
                <Column style={valueCol}>
                  <Text style={value}>{reference}</Text>
                </Column>
              </Row>
              <Row style={row}>
                <Column style={labelCol}>
                  <Text style={label}>Payout Amount:</Text>
                </Column>
                <Column style={valueCol}>
                  <Text style={value}>{formatCurrency(amountMinor)}</Text>
                </Column>
              </Row>
              <Row style={row}>
                <Column style={labelCol}>
                  <Text style={label}>Fee:</Text>
                </Column>
                <Column style={valueCol}>
                  <Text style={value}>-{formatCurrency(koraFeeAmount)}</Text>
                </Column>
              </Row>
              <Row style={row}>
                <Column style={labelCol}>
                  <Text style={label}>Bank:</Text>
                </Column>
                <Column style={valueCol}>
                  <Text style={value}>
                    {bankName} ****{accountLast4}
                  </Text>
                </Column>
              </Row>
              <Row style={row}>
                <Column style={labelCol}>
                  <Text style={label}>Failure Reason:</Text>
                </Column>
                <Column style={valueCol}>
                  <Text style={value}>{failureReason || "Unknown error"}</Text>
                </Column>
              </Row>
            </Section>

            <Hr style={divider} />

            <Text style={sectionTitle}>What to do next</Text>
            <Text style={step}>
              1. Check your bank account details are correct
            </Text>
            <Text style={step}>
              2. Ensure your bank account is active and can receive transfers
            </Text>
            <Text style={step}>
              3. Update your bank details in the app if needed
            </Text>
            <Text style={step}>4. Contact support if the issue persists</Text>

            <Hr style={divider} />

            <Text style={supportText}>
              For further enquiries, please contact our customer support through
              the following channels:
            </Text>
            <Text style={supportText}>
              Phone: <strong style={strong}>+234 9063611541</strong>
            </Text>
            <Text style={supportText}>
              Email:{" "}
              <Link
                href="mailto:support@dailyexpress.com"
                style={supportLink}
              >
                support@dailyexpress.com
              </Link>
            </Text>

            <Hr style={divider} />

            <Text style={footerText}>Thank you for choosing Daily Express.</Text>
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

const summary: React.CSSProperties = {
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

const infoTable = {
  width: "100%",
};

const row = {
  padding: "6px 0",
};

const labelCol = {
  width: "40%",
  verticalAlign: "top" as const,
};

const valueCol = {
  width: "60%",
  verticalAlign: "top" as const,
};

const label = {
  color: "#888",
  fontSize: "13px",
  margin: 0,
};

const value = {
  color: "#111",
  fontSize: "13px",
  fontWeight: "600" as const,
  margin: 0,
};

const strong = {
  color: "#111",
};

const step: React.CSSProperties = {
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

const footerText = {
  color: "#666",
  fontSize: "12px",
  margin: "4px 0",
  textAlign: "center" as const,
};

PayoutFailedEmail.PreviewProps = {
  frontendUrl: "",
  driverName: "Ibrahim Musa",
  driverEmail: "ibrahim@example.com",
  amountMinor: 8450000,
  koraFeeAmount: 50000,
  reference: "PO-2026-7781",
  failureReason: "Destination account is temporarily restricted",
  bankName: "Access Bank",
  accountLast4: "1024",
} as PayoutFailedEmailProps;

export default PayoutFailedEmail;