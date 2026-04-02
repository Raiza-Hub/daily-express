import * as React from "react";
import { render } from "@react-email/render";
import {
  VerifyOtpEmail,
  type VerifyOtpEmailProps,
} from "../../../../email/templates/VerifyOtpEmail";

export async function renderVerifyOtpEmail(
  props: VerifyOtpEmailProps,
): Promise<string> {
  return render(React.createElement(VerifyOtpEmail, props));
}
