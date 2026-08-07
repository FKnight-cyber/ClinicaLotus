export type AuthenticatedUser = {
  id: string;
  login: string;
  name: string;
  permissions: string[];
  activeClinicId: string | null;
  availableClinicIds: string[];
};