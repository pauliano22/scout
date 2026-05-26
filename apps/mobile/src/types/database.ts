// Per CLAUDE.md: "All shared DB types live in packages/shared/types/database.ts.
// Neither app may define its own copy of Supabase row types." This file is a
// thin re-export shim so existing `../types/database` imports across mobile
// keep working unchanged.
export type {
  Alumni,
  AlumniClaimSource,
  EducationEntry,
  Profile,
  UserNetwork,
  WorkHistoryEntry,
} from '@scout/shared/types/database';
