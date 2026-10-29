/** Browser-local original-file vault for provenance artifacts.
 * Files remain on this browser/device (IndexedDB); this is not cloud storage.
 */
export type StoredArtifactFile = {
  artifactId: string;
  fileName: string;
  mimeType: string;
  byteLength: number;
  sha256: string;
  blob: Blob;
  savedAt: string;
};

const DATABASE = 'waterchain-provenance-vault-v1';
const STORE = 'original-files';

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB is unavailable in this browser context.'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'artifactId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open the local provenance vault.'));
    request.onblocked = () => reject(new Error('The local provenance vault is blocked by another open database connection.'));
  });
}

export async function putArtifactFile(file: File, artifactId: string, sha256: string): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ artifactId, fileName: file.name, mimeType: file.type || 'application/octet-stream', byteLength: file.size, sha256, blob: file, savedAt: new Date().toISOString() } satisfies StoredArtifactFile);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Could not save the original document in browser storage.'));
      tx.onabort = () => reject(tx.error ?? new Error('Saving the original document was aborted.'));
    });
  } finally { db.close(); }
}

export async function getArtifactFile(artifactId: string): Promise<StoredArtifactFile | null> {
  const db = await openDatabase();
  try {
    return await new Promise<StoredArtifactFile | null>((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(artifactId);
      request.onsuccess = () => resolve((request.result as StoredArtifactFile | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error('Could not read the original document from browser storage.'));
    });
  } finally { db.close(); }
}

export async function deleteArtifactFile(artifactId: string): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(artifactId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Could not remove the original document from browser storage.'));
      tx.onabort = () => reject(tx.error ?? new Error('Removing the original document was aborted.'));
    });
  } finally { db.close(); }
}

export async function hashBlob(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function getVerifiedArtifactFile(artifactId: string, expectedSha256: string): Promise<StoredArtifactFile> {
  const stored = await getArtifactFile(artifactId);
  if (!stored) throw new Error('The original file is not present in this browser vault. It may be on another browser/device or only its fingerprint was stored.');
  if (stored.sha256 !== expectedSha256) throw new Error('Stored-file metadata hash does not match the artifact record. Do not use this file until the mismatch is reviewed.');
  const actual = await hashBlob(stored.blob);
  if (actual !== expectedSha256) throw new Error('The stored file SHA-256 does not match its recorded fingerprint. The file is not offered for download.');
  if (stored.byteLength !== stored.blob.size) throw new Error('The stored file byte length does not match its recorded size. The file is not offered for download.');
  return stored;
}
