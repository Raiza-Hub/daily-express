export interface KoraIdentityResponse {
  reference: string;
  id: string;
  id_type: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  date_of_birth: string;
  phone_number?: string;
  gender?: string;
  image?: string;
  validation?: Record<string, unknown>;
  requested_by: string;
}

export interface KoraIdentityEnvelope {
  status: boolean;
  message: string;
  data: KoraIdentityResponse;
}
