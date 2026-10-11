/** SHA-256 helpers used to spot files that are already on the site. */

function hex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function fileHash(file: Blob): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))
}

/** One fingerprint for an ordered set of files (for photos that are combined into one PDF). */
export async function combineHashes(hashes: string[]): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`set:${hashes.join(',')}`)))
}
