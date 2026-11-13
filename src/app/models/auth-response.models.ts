export interface AuthenticationRequest {
  email: string;
  password: string;
}

export interface UserDataDTO {
  id: number;
  fullName: string;
  email: string;
  isEnabled: boolean;
  roles: string[];
}

export interface AuthenticationResponse {
  token: string;
  user: UserDataDTO;
}
