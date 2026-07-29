import { File, Paths } from 'expo-file-system'
import { shareAsync } from 'expo-sharing'

function getMimeType(filename: string) {
  const name = filename.toLowerCase()
  if (name.endsWith('.csv')) {
    return 'text/csv'
  }
  return name.endsWith('.json') ? 'application/json' : 'text/plain'
}

export async function saveFile(filename: string, content: string) {
  const file = new File(Paths.cache, filename)
  try {
    file.create()
    file.write(content)
    await shareAsync(file.uri, {
      mimeType: getMimeType(filename),
      dialogTitle: 'Save the file',
    })
  } catch (e) {
    console.error(e)
  }
}
