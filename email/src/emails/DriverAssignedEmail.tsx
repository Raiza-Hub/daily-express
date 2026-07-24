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

export interface DriverAssignedEmailProps {
  frontendUrl: string;
  passengerName: string | null;
  driverName: string;
  driverPhone: string;
  vehicleMake: string;
  vehicleModel: string;
  vehiclePlateNumber: string;
  vehicleColor: string;
  pickupTitle: string;
  dropoffTitle: string;
  departureTime: string | Date;
  tripDate: string | Date;
  timeZone: string;
}

const DriverAssignedEmail = ({
  passengerName,
  driverName,
  driverPhone,
  vehicleMake,
  vehicleModel,
  vehiclePlateNumber,
  vehicleColor,
  pickupTitle,
  dropoffTitle,
  departureTime,
  tripDate,
  timeZone,
}: DriverAssignedEmailProps) => {
  const previewText = `Driver assigned for ${pickupTitle} to ${dropoffTitle}`;
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
              Your trip is confirmed and your driver is ready. Here's who to
              expect and what to know before departure.
            </Text>

            <Hr style={divider} />

            <Text style={sectionTitle}>Driver Details</Text>
            <Section style={infoTable}>
              <Row style={row}>
                <Column style={labelCol}>
                  <Text style={label}>Name:</Text>
                </Column>
                <Column style={valueCol}>
                  <Text style={value}>{driverName}</Text>
                </Column>
              </Row>
              <Row style={row}>
                <Column style={labelCol}>
                  <Text style={label}>Phone:</Text>
                </Column>
                <Column style={valueCol}>
                  <Text style={value}>{driverPhone}</Text>
                </Column>
              </Row>
            </Section>

            <Hr style={divider} />

            <Text style={sectionTitle}>Vehicle Details</Text>
            <Section style={infoTable}>
              <Row style={row}>
                <Column style={labelCol}>
                  <Text style={label}>Vehicle:</Text>
                </Column>
                <Column style={valueCol}>
                  <Text style={value}>
                    {vehicleMake} {vehicleModel}
                  </Text>
                </Column>
              </Row>
              <Row style={row}>
                <Column style={labelCol}>
                  <Text style={label}>Plate Number:</Text>
                </Column>
                <Column style={valueCol}>
                  <Text style={value}>{vehiclePlateNumber}</Text>
                </Column>
              </Row>
              <Row style={row}>
                <Column style={labelCol}>
                  <Text style={label}>Color:</Text>
                </Column>
                <Column style={valueCol}>
                  <Text style={value}>{vehicleColor}</Text>
                </Column>
              </Row>
            </Section>

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
                  <Text style={label}>Date:</Text>
                </Column>
                <Column style={valueCol}>
                  <Text style={value}>{formattedTripDate}</Text>
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
            </Section>

            <Text style={reminder}>
              Please arrive at the pickup point at least{" "}
              <strong style={strong}>15 minutes</strong> before departure.
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
              Thank you for choosing Daily Express.
            </Text>
            <Text style={footerText}>The Daily Express Team</Text>
          </Container>
        </Container>
      </Body>
    </Html>
  );
};

function parseDateInput(value: string | Date, timeZone?: string) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (/^\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    const naive = new Date(`1970-01-01T${value}Z`);
    if (Number.isNaN(naive.getTime())) return null;
    if (timeZone) {
      const localParts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour: "numeric",
        minute: "numeric",
        hour12: false,
        year: "numeric",
        month: "numeric",
        day: "numeric",
      }).formatToParts(naive);
      const lh = Number(localParts.find(p => p.type === "hour")?.value ?? 0);
      const lm = Number(localParts.find(p => p.type === "minute")?.value ?? 0);
      const localMinutes = lh * 60 + lm;
      const utcMinutes = naive.getUTCHours() * 60 + naive.getUTCMinutes();
      const offsetMinutes = localMinutes - utcMinutes;
      return new Date(naive.getTime() - offsetMinutes * 60_000);
    }
    return naive;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatTripDate(value: string | Date, timeZone: string) {
  const parsed = parseDateInput(value, timeZone);
  if (!parsed) return String(value);
  return new Intl.DateTimeFormat("en-NG", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function formatTripTime(value: string | Date, timeZone: string) {
  const parsed = parseDateInput(value, timeZone);
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

const reminder = {
  color: "#111",
  fontSize: "13px",
  lineHeight: "20px",
  marginTop: "16px",
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

DriverAssignedEmail.PreviewProps = {
  frontendUrl: "",
  passengerName: "Ada Okafor",
  driverName: "John Ade",
  driverPhone: "+234 803 000 1234",
  vehicleMake: "Toyota",
  vehicleModel: "Hiace",
  vehiclePlateNumber: "KJA-204-AA",
  vehicleColor: "White",
  pickupTitle: "Abeokuta",
  dropoffTitle: "Lagos",
  departureTime: "2:00 PM",
  tripDate: "Monday, June 15, 2026",
  timeZone: "Africa/Lagos",
} as DriverAssignedEmailProps;

export default DriverAssignedEmail;
