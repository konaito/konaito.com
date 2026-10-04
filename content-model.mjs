import fs from 'node:fs';

export function readArticleContent(root = new URL('./', import.meta.url)) {
  const directory = new URL('content/', root);
  return fs.readdirSync(directory).filter(name => name.endsWith('.json')).sort().flatMap(name => {
    const data = JSON.parse(fs.readFileSync(new URL(name, directory), 'utf8'));
    if (!Array.isArray(data)) throw new Error(`Content part must be an array: ${name}`);
    return data;
  });
}
