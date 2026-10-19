import type { ItemRow, MetadataRow, NotificationRow, ProfileRow, ReminderRow } from './library';

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<
  Row,
  Required extends keyof Row = never,
  Relations extends {
    foreignKeyName: string;
    columns: string[];
    isOneToOne: boolean;
    referencedRelation: string;
    referencedColumns: string[];
  }[] = [],
> = {
  Row: { [K in keyof Row]: Row[K] };
  Insert: {
    [K in keyof (Partial<Row> & Pick<Row, Required>)]: (Partial<Row> & Pick<Row, Required>)[K];
  };
  Update: { [K in keyof Row]?: Row[K] };
  Relationships: Relations;
};

export interface Database {
  public: {
    Tables: {
      pixelar_members: Table<{ id: string; name: string; created_at: string }, 'name'>;
      pixelar_member_credentials: Table<
        {
          member_id: string;
          username: string;
          email: string;
          password_hash: string;
          created_at: string;
          updated_at: string;
        },
        'member_id' | 'username' | 'email' | 'password_hash',
        [
          {
            foreignKeyName: 'pixelar_member_credentials_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: true;
            referencedRelation: 'pixelar_members';
            referencedColumns: ['id'];
          },
        ]
      >;
      pixelar_profiles: Table<ProfileRow, 'member_id'>;
      pixelar_item_statuses: Table<
        { kind: string; status: string; position: number },
        'kind' | 'status' | 'position'
      >;
      pixelar_items: Table<ItemRow, 'member_id' | 'kind' | 'status'>;
      pixelar_metadata_cache: Table<
        MetadataRow,
        'provider' | 'provider_id' | 'kind' | 'region' | 'fields'
      >;
      pixelar_reminders: Table<ReminderRow, 'member_id' | 'item_id' | 'days_before'>;
      pixelar_notifications: Table<
        NotificationRow,
        'member_id' | 'item_id' | 'title' | 'delivery_key'
      >;
    };
    Views: Record<string, never>;
    Functions: {
      create_pixelar_account: {
        Args: {
          account_name: string;
          account_username: string;
          account_email: string;
          account_password_hash: string;
        };
        Returns: string;
      };
      pixelar_process_releases: {
        Args: { target_member?: string; run_at?: string };
        Returns: number;
      };
      pixelar_save_item: { Args: { owner_id: string; payload: Json }; Returns: string };
      pixelar_save_shelf_layout: {
        Args: { owner_id: string; view_key: string; layout: Json };
        Returns: undefined;
      };
      pixelar_save_banner: {
        Args: { owner_id: string; library_kind: string; selected_item: string | null };
        Returns: undefined;
      };
      pixelar_update_profile: {
        Args: { owner_id: string; display_name: string; new_email: string; settings: Json };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
