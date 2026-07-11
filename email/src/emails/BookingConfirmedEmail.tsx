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
import { getEmailLogoSrc } from "../assets";

export interface BookingConfirmedEmailProps {
  frontendUrl: string;
  passengerName: string | null;
  paymentReference: string;
  pricePaid: string;
  pickupTitle: string;
  dropoffTitle: string;
  tripDate: string | Date;
  departureTime: string | Date;
  timeZone: string;
  meetingPoint: string;
}

const BookingConfirmedEmail = ({
  passengerName,
  paymentReference,
  pricePaid,
  pickupTitle,
  dropoffTitle,
  tripDate,
  departureTime,
  timeZone,
  meetingPoint,
}: BookingConfirmedEmailProps) => {
  const previewText = `Your booking to ${dropoffTitle} is confirmed!`;
  const formattedTripDate = formatTripDate(tripDate, timeZone);
  const formattedDepartureTime = formatTripTime(departureTime, timeZone);

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
            <Text style={greeting}>
              Dear {passengerName ? passengerName : "Passenger"},
            </Text>

            <Text style={summary}>
              Your booking has been confirmed and your payment of{" "}
              <strong style={strong}>{pricePaid}</strong> has been received.
            </Text>

            <Hr style={divider} />

            <Text style={sectionTitle}>Trip Details</Text>

            <Section style={infoTable}>
              <Row style={row}>
                <Column style={labelCol}>
                  <Text style={label}>Route:</Text>
                </Column>
                <Column style={valueCol}>
                  <Text style={value}>
                    {pickupTitle} to {dropoffTitle}
                  </Text>
                </Column>
              </Row>
              <Row style={row}>
                <Column style={labelCol}>
                  <Text style={label}>Departure Time:</Text>
                </Column>
                <Column style={valueCol}>
                  <Text style={value}>{formattedDepartureTime}</Text>
                </Column>
              </Row>
              <Row style={row}>
                <Column style={labelCol}>
                  <Text style={label}>Booking Reference:</Text>
                </Column>
                <Column style={valueCol}>
                  <Text style={value}>{paymentReference}</Text>
                </Column>
              </Row>
            </Section>

            <Hr style={divider} />

            <Text style={sectionTitle}>Current Status</Text>
            <Text style={summary}>
              Awaiting driver assignment. A driver has not yet accepted this
              trip. We are notifying eligible drivers and will update you once a
              driver is assigned.
            </Text>

            <Text style={sectionTitle}>What happens next?</Text>
            <Text style={bullet}>
              • If a driver accepts before departure, we'll send you the driver
              and vehicle details immediately.
            </Text>
            <Text style={bullet}>
              • If no driver is assigned by the departure deadline, we'll notify
              you with available options (reschedule or refund).
            </Text>

            <Text style={summary}>
              Meeting point:{" "}
              <strong style={strong}>{meetingPoint}</strong>
            </Text>

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
              <Link href="mailto:support@dailyexpress.app" style={supportLink}>
                support@dailyexpress.app
              </Link>
            </Text>

            <Hr style={divider} />

            <Text style={footerText}>
              Thank you for booking with Daily Express.
            </Text>
            <Text style={footerText}>The Daily Express Team</Text>
          </Container>
        </Container>
      </Body>
    </Html>
  );
};

function parseDateInput(value: string | Date) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatTripDate(value: string | Date, timeZone: string) {
  const parsed = parseDateInput(value);
  if (!parsed) return String(value);

  return new Intl.DateTimeFormat("en-NG", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function formatTripTime(value: string | Date, timeZone: string) {
  const parsed = parseDateInput(value);
  if (!parsed) return String(value);
  const parts = new Intl.DateTimeFormat("en-NG", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(parsed);
  const hour = parts.find(p => p.type === "hour")?.value ?? "";
  const minute = parts.find(p => p.type === "minute")?.value ?? "";
  const dayPeriod = parts.find(p => p.type === "dayPeriod")?.value?.toLowerCase() ?? "";
  return `${hour}:${minute}${dayPeriod}`;
}

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

const strong = {
  color: "#111",
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

const bullet = {
  color: "#111",
  fontSize: "13px",
  lineHeight: "20px",
  marginBottom: "8px",
  paddingLeft: "4px",
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

BookingConfirmedEmail.PreviewProps = {
  frontendUrl: "",
  passengerName: "Ada Okafor",
  paymentReference: "BK-92A7F4D1",
  pricePaid: "NGN 12,500.00",
  pickupTitle: "Yaba",
  dropoffTitle: "Ibadan",
  tripDate: "Saturday, April 25, 2026",
  departureTime: "08:30 AM",
  meetingPoint: "Daily Express Terminal, Yaba",
} as BookingConfirmedEmailProps;

export default BookingConfirmedEmail;
