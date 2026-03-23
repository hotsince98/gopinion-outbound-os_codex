export interface PostgresConnectionConfig {
  url?: string;
  schema?: string;
  provider?: "supabase" | "postgres";
}

export interface PostgresClient {
  provider: "supabase" | "postgres";
  query<TResult>(
    statement: string,
    params?: readonly unknown[],
  ): Promise<TResult[]>;
}
