export type Bindings = {
  giapha_db: D1Database
  giapha_avatars: R2Bucket
}

export type HonoEnv = {
  Bindings: Bindings
}
