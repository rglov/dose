import { App, normalizePath } from 'obsidian';
import { Protocol } from './types';
import { parseProtocol } from './protocol-parser';

export async function loadProtocols(app: App, folder: string): Promise<Protocol[]> {
  const folderPath = normalizePath(folder);
  const files = app.vault.getMarkdownFiles().filter(
    f => f.path.startsWith(folderPath + '/'),
  );

  const protocols: Protocol[] = [];
  for (const file of files) {
    try {
      const content = await app.vault.read(file);
      const protocol = parseProtocol(content, file.path);
      if (protocol) protocols.push(protocol);
    } catch {
      console.warn(`[Dose] Failed to parse protocol: ${file.path}`);
    }
  }
  return protocols;
}
