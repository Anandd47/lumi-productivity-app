function cleanName(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 48) : null
}

/** Resolve account names from saved profile data, then signup metadata. Never infer a name from email. */
export function resolveAccountDisplayName(profileName: unknown, metadataName: unknown): string | null {
  return cleanName(profileName) ?? cleanName(metadataName)
}
