/**
 * Sports — barrel export
 */
export {
  normalizeSport,
  cleanSportName,
  buildSportAliasMap,
  getCanonicalSportNames,
  findUnmappedSports,
  CANONICAL_SPORTS,
} from './normalize'

export type {
  NormalizedSportEntry,
  NormalizationResult,
} from './normalize'
