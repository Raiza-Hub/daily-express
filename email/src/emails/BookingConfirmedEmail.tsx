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

export interface BookingConfirmedEmailProps {
  frontendUrl: string;
  passengerName: string | null;
  paymentReference: string;
  pricePaid: string;
  pickupTitle: string;
  dropoffTitle: string;
  tripDate: string;
  departureTime: string;
  vehicleType: string;
  seatNumber: number;
  meetingPoint: string;
  driverName?: string | null;
  driverPhone?: string | null;
}

const BookingConfirmedEmail = ({
  frontendUrl = "",
  passengerName,
  paymentReference,
  pricePaid,
  pickupTitle,
  dropoffTitle,
  tripDate,
  departureTime,
  vehicleType,
  seatNumber,
  meetingPoint,
  driverName,
  driverPhone,
}: BookingConfirmedEmailProps) => {
  const previewText = `Your booking to ${dropoffTitle} is confirmed!`;
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
            <Text style={greeting}>
              Dear {passengerName ? passengerName : "Passenger"},
            </Text>

            <Text style={summary}>
              Great news! Your payment of{" "}
              <strong style={strong}>{pricePaid}</strong> has been received and your
              seat on the <strong style={strong}>{pickupTitle} to {dropoffTitle}</strong>{" "}
              trip is now confirmed.
            </Text>

            <Text style={summary}>
              Please review your booking details below and keep this email as your
              travel reference. We recommend arriving at the meeting point at least{" "}
              <strong style={strong}>15 minutes</strong> before your scheduled
              departure time.
            </Text>

            <Hr style={divider} />

            <Text style={sectionTitle}>Booking Details</Text>

            <Section style={infoTable}>
              <Row style={row}>
                <Column style={labelCol}>
                  <Text style={label}>Booking Reference:</Text>
                </Column>
                <Column style={valueCol}>
                  <Text style={value}>{paymentReference}</Text>
                </Column>
              </Row>
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
                  <Text style={label}>Trip Date:</Text>
                </Column>
                <Column style={valueCol}>
                  <Text style={value}>{tripDate}</Text>
                </Column>
              </Row>
              <Row style={row}>
                <Column style={labelCol}>
                  <Text style={label}>Departure Time:</Text>
                </Column>
                <Column style={valueCol}>
                  <Text style={value}>{departureTime}</Text>
                </Column>
              </Row>
              <Row style={row}>
                <Column style={labelCol}>
                  <Text style={label}>Vehicle Type:</Text>
                </Column>
                <Column style={{ ...valueCol }}>
                  <Text style={{ ...value, textTransform: "capitalize" }}>
                    {vehicleType}
                  </Text>
                </Column>
              </Row>
              <Row style={row}>
                <Column style={labelCol}>
                  <Text style={label}>Seat Number:</Text>
                </Column>
                <Column style={valueCol}>
                  <Text style={value}>{seatNumber}</Text>
                </Column>
              </Row>
              <Row style={row}>
                <Column style={labelCol}>
                  <Text style={label}>Meeting Point:</Text>
                </Column>
                <Column style={valueCol}>
                  <Text style={value}>{meetingPoint}</Text>
                </Column>
              </Row>
              {driverName && (
                <Row style={row}>
                  <Column style={labelCol}>
                    <Text style={label}>Driver Name:</Text>
                  </Column>
                  <Column style={valueCol}>
                    <Text style={value}>{driverName}</Text>
                  </Column>
                </Row>
              )}
              {driverPhone && (
                <Row style={row}>
                  <Column style={labelCol}>
                    <Text style={label}>Driver Phone:</Text>
                  </Column>
                  <Column style={valueCol}>
                    <Text style={value}>{driverPhone}</Text>
                  </Column>
                </Row>
              )}
            </Section>

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
  vehicleType: "bus",
  seatNumber: 7,
  meetingPoint: "Daily Express Terminal, Yaba",
  driverName: "Tunde Bello",
  driverPhone: "08030001234",
} as BookingConfirmedEmailProps;

export default BookingConfirmedEmail;