import { DriveDocFile, DriveFolderInfo } from '../types/knowledge';

const ROOT_FOLDER_NAME = 'CognitiveVault - Knowledge Archive';

/**
 * Searches for an existing folder or creates it if not found.
 */
export async function findOrCreateFolder(
  accessToken: string,
  folderName: string,
  parentId?: string
): Promise<DriveFolderInfo> {
  let query = `name = '${folderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      query
    )}&fields=files(id,name,mimeType,webViewLink)&pageSize=1`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!searchRes.ok) {
    const errorText = await searchRes.text();
    throw new Error(`Failed to search folder: ${errorText}`);
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    const f = searchData.files[0];
    return {
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      webViewLink: f.webViewLink || `https://drive.google.com/drive/folders/${f.id}`,
    };
  }

  // Create folder
  const createPayload: Record<string, any> = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) {
    createPayload.parents = [parentId];
  }

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(createPayload),
  });

  if (!createRes.ok) {
    const errorText = await createRes.text();
    throw new Error(`Failed to create folder '${folderName}': ${errorText}`);
  }

  const created = await createRes.json();
  return {
    id: created.id,
    name: created.name,
    mimeType: created.mimeType,
    webViewLink: created.webViewLink || `https://drive.google.com/drive/folders/${created.id}`,
  };
}

/**
 * Ensures the primary CognitiveVault root folder exists in the user's Drive.
 */
export async function getOrCreateRootKnowledgeFolder(accessToken: string): Promise<DriveFolderInfo> {
  return findOrCreateFolder(accessToken, ROOT_FOLDER_NAME);
}

/**
 * Ensures a category-specific subfolder exists inside the root knowledge folder.
 */
export async function getOrCreateCategoryFolder(
  accessToken: string,
  rootFolderId: string,
  categoryName: string
): Promise<DriveFolderInfo> {
  const cleanName = categoryName.trim() || 'General Research';
  return findOrCreateFolder(accessToken, cleanName, rootFolderId);
}

/**
 * Creates a Google Document file directly in the specified Drive folder.
 */
export async function createDocumentInDrive(
  accessToken: string,
  title: string,
  parentFolderId: string,
  description?: string,
  properties?: Record<string, string>
): Promise<DriveDocFile> {
  const payload: Record<string, any> = {
    name: title,
    mimeType: 'application/vnd.google-apps.document',
    parents: [parentFolderId],
    description: description || '',
  };

  if (properties) {
    payload.properties = properties;
  }

  const res = await fetch(
    'https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,createdTime,modifiedTime,webViewLink,iconLink,parents,properties,description',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to create Google Doc in Drive: ${errorText}`);
  }

  const doc = await res.json();
  return {
    id: doc.id,
    name: doc.name,
    mimeType: doc.mimeType,
    createdTime: doc.createdTime,
    modifiedTime: doc.modifiedTime,
    webViewLink: doc.webViewLink || `https://docs.google.com/document/d/${doc.id}/edit`,
    iconLink: doc.iconLink,
    category: properties?.category,
    tags: properties?.tags ? properties.tags.split(',') : [],
    executiveSummary: description,
    folderId: parentFolderId,
  };
}

/**
 * Lists all knowledge files and docs stored in the user's Drive.
 */
export async function listKnowledgeDocuments(
  accessToken: string,
  rootFolderId?: string
): Promise<DriveDocFile[]> {
  let query = "mimeType = 'application/vnd.google-apps.document' and trashed = false";
  if (rootFolderId) {
    // Also include files inside category subfolders by listing files where parents match
    query += ` and '${rootFolderId}' in parents`;
  }

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      query
    )}&fields=files(id,name,mimeType,createdTime,modifiedTime,webViewLink,iconLink,parents,properties,description)&pageSize=50&orderBy=modifiedTime desc`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to list Drive files: ${errorText}`);
  }

  const data = await res.json();
  const files: DriveDocFile[] = (data.files || []).map((f: any) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    createdTime: f.createdTime,
    modifiedTime: f.modifiedTime,
    webViewLink: f.webViewLink || `https://docs.google.com/document/d/${f.id}/edit`,
    iconLink: f.iconLink,
    category: f.properties?.category || 'General Research',
    tags: f.properties?.tags ? f.properties.tags.split(',') : [],
    executiveSummary: f.description || '',
    folderId: f.parents?.[0],
  }));

  return files;
}

/**
 * Deletes a file from Google Drive.
 * (MANDATORY: MUST be preceded by user confirmation dialog in the UI)
 */
export async function deleteDriveFile(accessToken: string, fileId: string): Promise<void> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok && res.status !== 204) {
    const errorText = await res.text();
    throw new Error(`Failed to delete Drive file: ${errorText}`);
  }
}
