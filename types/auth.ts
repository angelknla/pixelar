export interface ActionState {
  error?: string;
  message?: string;
}

export interface MemberAccount {
  memberId: string;
  name: string;
  username: string;
  email: string;
}

export interface CredentialRow {
  member_id: string;
  username: string;
  email: string;
  password_hash: string;
}
